/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

import { debug } from "N/log";
import * as NRecord from "N/record";
import * as NRuntime from "N/runtime";
import { EntryPoints } from "N/types";

import { Invoice } from "../../Libraries/SalesTransactions/Invoice";

const MAIN_SUBSIDIARY_ID = 1;

export function afterSubmit(context: EntryPoints.UserEvent.afterSubmitContext): void {
    debug("afterSubmit", { recordId: context.newRecord.id, eventType: context.type });

    if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
        return;
    }

    const invoice = new Invoice(NRecord.load({
        type: NRecord.Type.INVOICE,
        id: context.newRecord.id
    }));

    // PBI #404673: Billing Period Memo on Billing Portal Invoices
    if (invoice.subsidiary === MAIN_SUBSIDIARY_ID
        && (NRuntime.executionContext == NRuntime.ContextType.WEBSERVICES
            || NRuntime.executionContext == NRuntime.ContextType.REST_WEBSERVICES)) {
        invoice.setDefaultBillingPeriod();
    }

    invoice.applyTaxCodeOverrides();

    invoice.save();
}

export function beforeSubmit(context: EntryPoints.UserEvent.beforeSubmitContext): void {
    const invoice = new Invoice(context.newRecord);

    invoice.initializeSoftwareEditionFields();
}

export function beforeLoad(context: EntryPoints.UserEvent.beforeLoadContext): void {
    

    const invoice = new Invoice(context.newRecord);
    const isValidToOverrideTaxAmount = invoice.matchingTaxCodeOverride(context.newRecord).matched;

    debug("Is Valid To Override Tax Amount", isValidToOverrideTaxAmount);

    if (isValidToOverrideTaxAmount) {
        context.newRecord.setValue({
            fieldId: "custbody_ava_taxoverride",
            value: true
        });
    }

    const invoiceRecSubsidiary = context.newRecord.getValue("subsidiary");
    //const invoiceForm = context.newRecord.getText({fieldId: "customform"});

    debug("Subsidiary", invoiceRecSubsidiary);

    if (NRuntime.executionContext !== NRuntime.ContextType.USER_INTERFACE) {
        return;
    }

    context.form.addButton({
        id: "custpage_send_as_email",
        label: "Send as Email",
        functionName: "onClickSendAsEmail"
    });

    // TODO: Remove this when SuiteBilling goes live.
    if (invoiceRecSubsidiary != 18) {
        context.form.addButton({
            id: "custpage_print",
            label: "Print",
            functionName: "onClickPrint"
        });
    }

    // TODO: Remove this when SuiteBilling goes live.
    if (invoiceRecSubsidiary != 59 && invoiceRecSubsidiary != 18) {
        context.form.removeButton({ id: "print" });
    }

    context.form.clientScriptModulePath = "../FormClientScripts/Transactions_InvoiceFormClientScript.js";
}