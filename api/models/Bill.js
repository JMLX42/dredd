var keystone = require('keystone');
var transform = require('model-transform');

var Types = keystone.Field.Types;

var Bill = new keystone.List('Bill', {
});

Bill.add({
    legislature: { type: Types.Number, required: true, initial: true },
    number: { type: Types.Number, required: true, initial: true },
    registrationDate: { type: Types.Date, required: true, initial: true },
    importDate: { type: Types.Datetime, required: true, initial: true },
	text: { type: Types.Textarea, height: 400 }
});

transform.toJSON(Bill);

Bill.defaultColumns = 'legislature, number, recordingDate, importDate';
Bill.register();
