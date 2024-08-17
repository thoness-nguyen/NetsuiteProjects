/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */
define(['N/search', 'N/record', 'N/runtime'],
        function(search, record, runtime) {
        function execute(context) {
        
            // Call the saved search
            var subscriptionSearch = search.load({
                id: 'customsearch_tc_sub_maindt'
            });
            var searchResultCount = subscriptionSearch.runPaged().count;
            log.debug("Subscription search count", searchResultCount);
            
            // if there is nothing to update, stop at here
            if (searchResultCount === 0) {
            log.debug("Maintenance expiration date for customer is already up-to-date.");
            return;
        }
            subscriptionSearch.run().each(function(result) {
            var customerId = result.getValue({ name: 'custrecord_tc_sub_customer' });
            var activeContractEndDate = result.getValue({ name: 'custrecord_tc_subscription_contract_edt' });

            // Submit body field without load or submit parent record
            try {
                record.submitFields({
                type: record.Type.CUSTOMER,
                id: customerId,
                values: {
                    'custentity_tc_maint_exp': activeContractEndDate
                },
                options: {
                    enablesourcing: false,
                    ignoreMandatoryFields: true
                }
            })
                log.debug("Updated customer", customerId);
            } catch (error) {
                log.error("Error updating customer " + customerId, error.message);
            }
            return true; // continue to next result
            });
        }
        return {
        execute: execute
        };
    });