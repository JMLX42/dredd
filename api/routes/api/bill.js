var keystone = require('keystone');
var marked = require('marked');
var elasticsearch = require('elasticsearch');

var BillTextParser = require('../../helper/BillTextParser');

var Bill = keystone.list('Bill');

exports.list = function(req, res)
{
    Bill.model.find()
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

            return res.apiResponse({bill : bill});
        });
}

exports.parse = function(req, res) {
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

            var parser = new BillTextParser();
            var ast = parser.parse(bill.text);

            return res.apiResponse({
                ast:parser.getSerializableAST(),
                // tokens:tokens
            });
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

exports.search = function(req, res)
{
    if (req.query.query)
    {
        searchQuery(
            req.query.query,
            function(ids)
            {
                filterBills(
                    req,
                    ids,
                    function(bills)
                    {
                        return res.apiResponse(bills);
                    },
                    function(err)
                    {
                        return res.apiError('database error', err);
                    }
                );
            },
            function(err)
            {
                return res.apiError(err.message);
            }
        );
    }
    else
    {
        filterBills(
            req,
            null,
            function(bills)
            {
                return res.apiResponse(bills);
            },
            function(err)
            {
                return res.apiError('database error', err);
            }
        );
    }
}

function filterBills(req, ids, successCallback, errorCallback)
{
    var crit = {
        registrationDate : {
            '$lte' : req.query.before ? new Date(req.query.before) : Date.now(),
            '$gte' : req.query.after ? new Date(req.query.after) : new Date(0)
        },
        importDate : {
            '$lte' : req.query.importedBefore ? new Date(req.query.importedBefore) : Date.now(),
            '$gte' : req.query.importedAfter ? new Date(req.query.importedAfter) : new Date(0)
        }
    };

    if (ids)
        crit._id = {$in : ids};

    Bill.model.find(crit)
        .select('-text')
        .exec(function(err, bills)
        {
            if (err)
                return errorCallback(err);

            return successCallback(bills);
        });
}

function searchQuery(query, successCallback, errorCallback)
{
    var connectionString = 'http://127.0.0.1:9200';
    var client = new elasticsearch.Client({
        host: connectionString
    });

    client.search({
        index : 'bill',
        type : 'document',
        fields : [],
        body : {
            query : {
                query_string : {
                   query: query
                }
            }
        }
    }).then(function(resp)
        {
            var ids = [];
            for (var hit of resp.hits.hits)
                ids.push(hit._id);

            successCallback(ids);
        },
        function(err)
        {
            errorCallback(err);
        }
    );
}
