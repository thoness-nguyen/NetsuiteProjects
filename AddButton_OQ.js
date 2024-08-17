function beforeLoad(type, form) {
    var context = nlapiGetContext();
    if ((context.getExecutionContext() == 'userinterface') && (type == 'edit' || type == 'view')) {

        // Replace 'customsublis128' with your sublist ID
        var OQsublist = form.getSubList('customsublist128'); // Custom sublist ID
        if (OQsublist != null) {
            // Get record field values
            var oppId = nlapiGetRecordId(); // Opportunity record ID

            // Add button to sublist
            OQsublist.addButton('custpage_newOQButton', 'New Opportunity Qualifier', generateOQRUrl(oppId));
        }
    }
}

function generateOQRUrl(oppId) {
    // Construct the URL for creating a new custom record
    var recordTypeId = 3714; // Replace with your custom record type ID
    var fieldId = 'CUSTRECORD114'; // Replace with your field ID
    var paramOppId = 'pi=' + oppId; // Opportunity ID parameter
    var paramRecordType = 'rectype=' + recordTypeId; // Record type parameter
    var paramRecordId = 'pr=-31'; // Additional parameter if needed

    // Construct the URL correctly
    var url = 'https://907826-sb1.app.netsuite.com/app/common/custom/custrecordentry.nl?' +
              paramRecordType + '&' + // Append the record type parameter
              'pf=' + fieldId + '&' + // Append the field parameter
              paramOppId + '&' + // Append the opportunity ID parameter
              paramRecordId; // Append the additional parameter

    return 'document.location=\'' + url + '\'';
}
