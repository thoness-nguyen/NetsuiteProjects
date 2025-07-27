/**
 * @NApiVersion 2.1
 */

import * as NError from "N/error";
import { runSuiteQL } from "N/query";
import { getValueFrom, RecordLike } from "../RecordUtils";

export class TaxCodeOverride {
    constructor(private readonly _record: RecordLike) { }

    get id(): number | null {
        return getValueFrom(this._record, "id") || null;
    }

    get custrecord_txn_taxcdovrd_taxcode(): number | null {
        return getValueFrom(this._record, "custrecord_txn_taxcdovrd_taxcode");
    }

    get custrecord_txn_taxcdovrd_subsidiary(): number | null {
        return getValueFrom(this._record, "custrecord_txn_taxcdovrd_subsidiary");
    }

    get custrecord_txn_taxcdovrd_shiptostate(): number | null {
        return getValueFrom(this._record, "custrecord_txn_taxcdovrd_shiptostate");
    }

    get custrecord_txn_override_tax_amount(): boolean | null {
        return getValueFrom(this._record, "custrecord_txn_override_tax_amount");
    }

    /**
     * Gets all active tax code overrides.
     */
    static getAll(): TaxCodeOverride[] {
        return runSuiteQL({
            query: `
            SELECT
                id,
                custrecord_txn_taxcdovrd_taxcode,
                custrecord_txn_taxcdovrd_subsidiary,
                custrecord_txn_taxcdovrd_shiptostate,
                custrecord_txn_override_tax_amount
            FROM
                customrecord_txn_tax_code_override   
            WHERE
                isInactive = 'F'`
        })
            .asMappedResults()
            .map(x => new TaxCodeOverride(x));
    }

    /**
     * Get state in ID
     * @param stateStr 
     */
    static getStateInternalId(stateStr: string): number | null {
        const results = runSuiteQL({
            query: `
            SELECT
                id
            FROM
                state
            WHERE
                shortname = '${stateStr}'`
        }).asMappedResults<{ id: number }>();

        if (results.length == 0) {
            return null;
        }
        return results[0].id;
    }

    /**
     * Ensures this tax code override is unique across all active and inactive tax code overrides.
     * If it is not, an error is thrown.
     */
    assertIsUnique(): void {
        const duplicateSearchResults = runSuiteQL({
            query: `
            SELECT
                id
            FROM
                customrecord_txn_tax_code_override
            WHERE
                id != ${this.id ?? 0}
                AND custrecord_txn_taxcdovrd_subsidiary = ${this.custrecord_txn_taxcdovrd_subsidiary}
                AND custrecord_txn_taxcdovrd_shiptostate = ${this.custrecord_txn_taxcdovrd_shiptostate}`
        }).asMappedResults();

        if (duplicateSearchResults.length > 0) {
            throw NError.create({
                name: "DUPLICATE_TAX_CODE_OVERRIDE",
                message: "This tax code override is a duplicate of another existing override record. There can only be one tax code override for a given subsidiary and ship to state combination."
            });
        }
    }
}