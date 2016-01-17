var keystone = require('keystone');
var transform = require('model-transform');

var Types = keystone.Field.Types;

var Bill = new keystone.List('Bill', {
});

Bill.add({
    legislature: { type: Types.Number, required: true, initial: true },
    number: { type: Types.Number, required: true, initial: true },
	text: { type: Types.Markdown, wysiwyg: true, height: 400 }
});

transform.toJSON(Bill);

Bill.defaultColumns = 'legislature, number';
Bill.register();
