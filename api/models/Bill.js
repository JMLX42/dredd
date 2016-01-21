var keystone = require('keystone');
var transform = require('model-transform');
var elasticsearch = require('elasticsearch');

var Types = keystone.Field.Types;

var Bill = new keystone.List('Bill', {
});

Bill.add({
    legislature: { type: Types.Number, required: true, initial: true, index: true },
    number: { type: Types.Number, required: true, initial: true, index: true },
    registrationDate: { type: Types.Date, required: true, initial: true, index: true },
    importDate: { type: Types.Datetime, required: true, initial: true },
	text: { type: Types.Textarea, height: 400 }
});

Bill.schema.pre('save', function(next)
{
    var connectionString = 'http://127.0.0.1:9200';
    var client = new elasticsearch.Client({
        host: connectionString
    });

    client.index(
        {
            index : 'bill',
            type : 'document',
            id : this.id,
            body : {
                legislature : this.legislature,
                number : this.number,
                text : this.text
            }
        },
        function (error, response)
        {
            // console.log(response);
        }
    );

    next();
});

transform.toJSON(Bill);

Bill.defaultColumns = 'legislature, number, recordingDate, importDate';
Bill.register();
