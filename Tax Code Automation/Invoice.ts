/**
 * @NApiVersion 2.1
 */

import * as NError from "N/error";
import { runSuiteQL } from "N/query";
import * as NRecord from "N/record";
import * as NRuntime from "N/runtime";

import { Logger } from "/SuiteScripts/MISShared/Logging/Logger";

import { Customer } from "../Customers/Customer";
import { TaxCodeOverride } from "../TaxCodeOverrides/TaxCodeOverride";
import { SalesTransaction } from "./SalesTransaction";
import { AutoGetSet } from "SuiteScripts/MISShared/StronglyTypedRecord";
import { RecordLike } from "../RecordUtils";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export class Invoice extends SalesTransaction<NRecord.Type.INVOICE> {
    private readonly _logger = Logger.createDefaultLogger();

    private _postingPeriodClosed: boolean | undefined;

    @AutoGetSet()
    accessor email: string | null = null;

    @AutoGetSet()
    accessor recurringbill: boolean = false;

    @AutoGetSet()
    accessor custbody_ns_email_sent: boolean = false;

    @AutoGetSet()
    accessor custbody_tc_statement: number | null = null;

    @AutoGetSet({ fieldId: "custbody5" })
    accessor doNotSendToCustomer: boolean = false;

    @AutoGetSet()
    accessor custbody_is_network_invoice: boolean = false;

    /**
     * Validates and returns the one-and-only matching tax code override.
     */
    matchingTaxCodeOverride(curRec: RecordLike): {matched: boolean, taxCode?: number | null} {
        if (curRec && typeof curRec.getValue === "function") {
            const shippingState = curRec.getValue("shipstate") as string;
            const shipToStateId = TaxCodeOverride.getStateInternalId(shippingState);

            if (shipToStateId) {
                const matchingOverrides = TaxCodeOverride.getAll().filter(x =>
                    x.custrecord_txn_taxcdovrd_subsidiary == this.subsidiary
                    && x.custrecord_txn_taxcdovrd_shiptostate == shipToStateId);

                if (matchingOverrides.length == 0) {
                    return { matched: false };
                }
                else if (matchingOverrides.length > 1) {
                    throw NError.create({
                        name: "TAX_CODE_OVERRIDE_CONFLICT",
                        message: `Multiple matching tax code overrides were found for invoice ${this.id}.`
                    });
                }
                else {
                    return {
                        matched: true,
                        taxCode: matchingOverrides[0].custrecord_txn_taxcdovrd_taxcode
                    };
                }
            }
        }
        return { matched: false };
    }

    /**
     * Applies any configured tax code overrides to this invoice.
     */
    applyTaxCodeOverrides(): void {
        const shipToStateIdResults = runSuiteQL({
            query: `
            SELECT
                ste.id
            FROM
                transaction as txn
                    JOIN transactionShippingAddress as shp
                        ON txn.shippingaddress = shp.nKey
                    JOIN state as ste
                        ON shp.dropdownstate = ste.shortname
                        AND shp.country = ste.country
                        
            WHERE
                txn.id = ${this.id}`
        }).asMappedResults<{ id?: number }>();

        if (!shipToStateIdResults || shipToStateIdResults.length == 0 || !shipToStateIdResults[0].id) {
            return;
        }

        const shipToStateId = shipToStateIdResults[0].id;
        const overrides = TaxCodeOverride.getAll();

        const matchingOverrides = overrides.filter(x =>
            x.custrecord_txn_taxcdovrd_subsidiary == this.subsidiary
            && x.custrecord_txn_taxcdovrd_shiptostate == shipToStateId);

        if (matchingOverrides.length == 0) {
            return;
        }

        if (matchingOverrides.length > 1) {
            throw NError.create({
                name: "TAX_CODE_OVERRIDE_CONFLICT",
                message: `Multiple matching tax code overrides were found for invoice ${this.id}.`
            });
        }

        const taxCodeOverride = matchingOverrides[0];

        this.forEachSublistLine("item", line => {
            const itemType = line.getValue("itemtype");

            if (itemType == "EndGroup") {
                return;
            }

            line.setValue("taxcode", taxCodeOverride.custrecord_txn_taxcdovrd_taxcode);
        });
    }

    /**
     * Sets the software edition (SWE) custom fields using the current customer on the transaction.
     */
    initializeSoftwareEditionFields(): void {
        const benchmarkRef = this._logger.beginBenchmark("initializeSoftwareEditionFields");

        if (!this.entity || this.isPostingPeriodClosed()) {
            return;
        }

        if (!this.custbody_end_user && !this.custbody_reseller && !this.custbody_distributor) {
            const customer = new Customer(NRecord.load({
                type: NRecord.Type.CUSTOMER,
                id: this.entity
            }));
    
            switch (customer.custentity_customer_channel_tier?.refName) {
                case "End User":
                    this.custbody_end_user = this.entity;
                    this.custbody_reseller = customer.custentity_reseller;
                    break;
            }
        }

        // For perofrmance purposes, don't set the list rate in the UI.
        if (NRuntime.executionContext !== NRuntime.ContextType.USER_INTERFACE) {
            this.forEachSublistLine("item", line => {
                const itemType = line.getValue("itemtype");
    
                if (itemType == "EndGroup") {
                    return;
                }
                
                const listRate = line.getValue("custcol_list_rate");
        
                if (!listRate) {
                    const unitPrice = line.getValue("rate");
                    
                    line.setValue("custcol_list_rate", unitPrice);
                }
            });
        }

        this._logger.endBenchmark(benchmarkRef);
    }

    /**
     * Indicates whether or not the posting period for this invoice has been closed.
     */
    isPostingPeriodClosed(): boolean {
        if (typeof this._postingPeriodClosed === "undefined") {
            const postingPeriod = this.postingPeriod;

            if (!postingPeriod) {
                return false;
            }

            const results = runSuiteQL({
                query: `
                    SELECT
                        closed
                    FROM
                        accountingPeriod
                    WHERE
                        id = ${postingPeriod}`
            }).asMappedResults<{ closed: string }>();

            this._postingPeriodClosed = results && results.length > 0 && results[0].closed === "T";
        }

        return this._postingPeriodClosed;
    }

    /**
     * Sets custbody_bs_billing_period using the month of the invoice's trandate if it is not already set.
     * Example: "October 2024"
     */
    setDefaultBillingPeriod(): void {
        let billingPeriod = this.custbody_bs_billing_period;
    
        if (billingPeriod) {
            return;
        }

        const tranDate = this.trandate;
    
        billingPeriod = `${MONTH_NAMES[tranDate.getMonth()]} ${tranDate.getFullYear()}`;
    
        this.custbody_bs_billing_period = billingPeriod;
    }
}