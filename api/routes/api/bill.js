var keystone = require('keystone');

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

            return res.apiResponse({ bill : bill});
        });
}
