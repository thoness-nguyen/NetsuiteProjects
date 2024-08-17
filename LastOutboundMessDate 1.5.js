/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */
define(['N/search', 'N/record', 'N/log'], function(search, record, log) {
    function execute(context) {
        // Create the saved search
        var messSearch = search.create({
            type: search.Type.MESSAGE,
            filters: [
                ["messagedate", "within", "today"],
                "AND",
                ["entity.custentity_tc_psa_project", "is", "T"],
                "AND",
                ["formulanumeric: CASE WHEN {author} like '%@truecommerce.com' and {authoremail} like '%@truecommerce.com' and {isincoming} = 'T' then 1 WHEN {author} not like '%@truecommerce.com' and {author.entityid} != '-System-' and {isincoming} = 'T' then 1 WHEN {author.entityid} != '-System-' and {isincoming} = 'F' then 1 WHEN {isincoming} = 'F' then 1 else 0 end", "equalto", "1"]
            ],
            columns: [
                search.createColumn({
                    name: 'internalid',
                    join: 'entity',
                    summary: search.Summary.GROUP
                }),
                search.createColumn({
                    name: 'messagedate',
                    summary: search.Summary.MAXIMUM
                }),
            ]
        });

        // Run paged search
        var pagedData = messSearch.runPaged({
            pageSize: 100 // Adjust the page size as needed
        });

        log.debug("Total pages", pagedData.pageRanges.length);

        // Initialize total count variable
        var totalCount = 0;

        // Iterate through each page to count total rows
        pagedData.pageRanges.forEach(function(pageRange) {
            var currentPage = pagedData.fetch(pageRange.index);
            totalCount += currentPage.data.length; // Increment total count for each row in current page
        });

        // Log the total count of rows
        log.debug("Total rows", totalCount);

        // Reset totalCount to zero for processing
        totalCount = 0;

        // Iterate through each page to process each row
        pagedData.pageRanges.forEach(function(pageRange) {
            var currentPage = pagedData.fetch(pageRange.index);

            // Iterate through each result in the current page
            currentPage.data.forEach(function(result) {
                totalCount++; // Increment total count for each row processed
                
                var columns = result.columns;
                var projectID = result.getValue(columns[0]);
                var lastMessageDate = result.getValue(columns[1]);

                // Submit field 'custentity_tc_last_outbound_mess' to Project record
                try {
                    if (projectID) {  // Ensure projectID is not null
                        record.submitFields({
                            type: record.Type.JOB,
                            id: projectID,
                            values: {
                                'custentity_tc_last_outbound_mess': lastMessageDate
                            },
                            options: {
                                enableSourcing: false,
                                ignoreMandatoryFields: true
                            }
                        });
                        log.debug("Updated Last Outbound Email for Project ID", projectID);
                    }
                } catch (error) {
                    log.error("Error updating Message Date for Project ID " + projectID, error.message);
                }
            });
        });

        // Log the total count of processed rows
        log.debug("Total rows processed", totalCount);
    }

    return {
        execute: execute
    };
});
