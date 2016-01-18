var keystone = require('keystone');
var marked = require('marked');

var Bill = keystone.list('Bill');

exports.list = function(req, res)
{
    Bill.model.find({
            registrationDate : {
                '$lte' : req.query.before ? new Date(req.query.before) : Date.now(),
                '$gte' : req.query.after ? new Date(req.query.after) : new Date(0)
            },
            importDate : {
                '$lte' : req.query.importedBefore ? new Date(req.query.importedBefore) : Date.now(),
                '$gte' : req.query.importedAfter ? new Date(req.query.importedAfter) : new Date(0)
            }
        })
        .select('-text')
        .exec(function(err, bills)
        {
            if (err)
                return res.apiError('database error', err);

            return res.apiResponse({ bills : bills});
        });
}

exports.get = function(req, res)
{
    console.log(req.query);
    Bill.model
        .findOne({
            legislature : req.params.legislature,
            number : req.params.number
        })
        .exec(function(err, bill)
        {
            if (err)
                return res.apiError('database error', err);

            if (!bill)
                res.status(404).send();

            if (req.query.format == 'md')
                bill.text = toMarkdown(bill.text);
            else if (req.query.format == 'html')
                bill.text = marked(toMarkdown(bill.text));

            return res.apiResponse({ bill : bill});
        });
}

function toMarkdown(text)
{
    // text = text.replace(/^- /gm, '* ');
    text = text.replace(/^PROJET\s+DE\s+LOI/gm, '# PROJET DE LOI');
    text = text.replace(/^TITRE /gm, '## TITRE ');
    text = text.replace(/^Chapitre /gm, '### Chapitre ');
    text = text.replace(/^Section /gm, '#### Section ');
    text = text.replace(/^Article /gm, '##### Article $1');
    text = text.replace(/^([IXVCM]+)\./gm, '###### $1.');

    return text;
}
