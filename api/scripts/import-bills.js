var keystone = require('keystone');
var async = require('async');
var striptags = require('striptags');
var Entities = require('html-entities').AllHtmlEntities;
var iconv  = require('iconv-lite');
var request  = require('request');

var Bill = keystone.list('Bill');

module.exports = function(legislature, force, bill, done)
{
    console.log('fetching bills for legislature', legislature);

    var numErrors = 0;
    var numSkipped = 0;
    var importSpecificBill = !!bill;
    var billNumberToImport = importSpecificBill ? parseInt(bill) : 0;

    fetchBillURIs(
        legislature,
        function(uris)
        {
            console.log(uris.length + ' bills fetched');

            var numImportedBills = 0;

            var ops = uris.map(function(uri)
            {
                return function(callback)
                {
                    var billNumber = getBillNumber(uri);

                    console.log(
                        Math.ceil(numImportedBills / uris.length * 100) + '%'
                        + '\t(' + ++numImportedBills + '/' + uris.length
                        + ') importing bill ' + billNumber
                    );
                    Bill.model.findOne({legislature : legislature, number : billNumber})
                        .exec(function(err, bill)
                        {
                            if (err)
                                return callback(err);

                            if (!bill || force == 'true' || (importSpecificBill && billNumber == billNumberToImport))
                            {
                                fetchBillMarkdown(
                                    legislature,
                                    uri,
                                    function(text)
                                    {
                                        getRegistrationDate(
                                            legislature,
                                            billNumber,
                                            text,
                                            function(registrationDate)
                                            {
                                                if (!bill)
                                                {
                                                    bill = Bill.model({
                                                        legislature: legislature,
                                                        number: billNumber,
                                                        text: text,
                                                        registrationDate: registrationDate,
                                                        importDate: Date.now()
                                                    });
                                                }
                                                else
                                                {
                                                    bill.text = text;
                                                    bill.registrationDate = registrationDate;
                                                    bill.importDate = Date.now();
                                                }

                                                bill.save(function(err)
                                                {
                                                    console.log('\tok: imported');
                                                    return callback(err);
                                                });

                                            },
                                            function(err)
                                            {
                                                numErrors++;
                                                console.log('\terror: could not parse recording date');

                                                return callback();
                                            }
                                        );
                                    },
                                    function(body)
                                    {
                                        if (body.indexOf('pas encore édité') >= 0)
                                        {
                                            numSkipped++;
                                            console.log('\tskip: not yet available');
                                        }
                                        else
                                        {
                                            numErrors++;
                                            console.log('\terror: could not parse text');
                                        }

                                        return callback();
                                    }
                                );
                            }
                            else
                            {
                                numSkipped++;
                                console.log('\tskip: already imported');

                                return callback();
                            }
                        });
                };
            });

            async.waterfall(ops, function(error)
            {
                if (error)
                    console.log(error);

                console.log(
                    'total: ' + uris.length
                    + ', success: ' + (uris.length - numErrors - numSkipped)
                    + ', skipped: ' + numSkipped
                    + ', error: ' + numErrors
                );

                done();
            });
        }
    );
}

function getBillNumber(uri)
{
    var re = /(pion|pl)(\d+)/g;
    var match = re.exec(uri);

    return parseInt(match[2]);
}

function fetchBillURIs(legislature, callback)
{
    request(
        {
            uri: "http://www2.assemblee-nationale.fr/documents/liste/(type)/depots/(archives)/index-depots/(limit)/999999999999/(legis)/"
                + legislature
        },
        function(error, response, body)
        {
            var projectAnchors = null;
            var re = new RegExp(
                '<a href="(/documents/notice/' + legislature + '/(propositions|projets)/(pion|pl)\\\d+/\\\(index\\\)/depots)"',
                'g'
            );

            var uris = [];
            while ((projectAnchors = re.exec(body)) !== null)
                uris.push('http://www2.assemblee-nationale.fr' + projectAnchors[1]);

            callback(uris);
        }
    );
}

function fetchBillMarkdown(legislature, uri, successCallback, errorCallback)
{
    request(
        {
            uri: uri
        },
        function(error, response, body)
        {
            var text = body;
            var begin = text.indexOf(
                '<!-- Contenu -->',
                text.indexOf('<div class="interieur-contenu-principal"')
            );
            var end = text.indexOf('<hr size="1" noshade="noshade"/>');

            if (begin < 0 || end < 0 || end < begin)
                return errorCallback && errorCallback(text);

            text = text.substring(begin, end);

            // strip all HTML tags
            text = striptags(text);

            // remove horizontal rules made of undercores
            text = text.replace(/^\*\*_+\*\*$/gm, '');

            // replace em dash with an actual dash
            text = text.replace(/^&#8211;/gm, '-');

            // decode HTML entities
            text = new Entities().decode(text);
            // remove Windows nl
            text = text.replace(/\r/gm, '');
            // trim whitespaces
            text = text.trim();

            successCallback(text);
        });
}

function guessRecordingYear(legislature, number, day, month, successCallback, errorCallback)
{
    console.log('\twarning: missing registration year, guessing based on the next bill')
    Bill.model.findOne({legislature:legislature, number: {$gt:number}})
        .sort('number')
        .select('-text')
        .exec(function(err, nextBill)
        {
            if (err)
                return errorCallback(err);

            if (month > nextBill.registrationDate.getMonth() + 1)
                return successCallback(new Date(
                    (nextBill.registrationDate.getFullYear() - 1)
                    + '-' + month
                    + '-' + day
                ));
            else
                return successCallback(new Date(
                    nextBill.registrationDate.getFullYear()
                    + '-' + month
                    + '-' + day
                ));
        });
}

function getRegistrationDate(legislature, number, text, successCallback, errorCallback)
{
    var months = [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
        'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];
    var re = /^\s*enregistrée? à la présidence\sde l['’]assemblée nationale\s+le (\d+|1er)\s+(.+)\s+(\d{4})\s*\.?$/im;
    var match = re.exec(text);

    if (!match)
    {
        // Sometimes, the year is not specified. So we will have to fetch the day & month
        // and guess the year based on those values + the values of the "next" bill.
        var re = /^\s*enregistrée? à la présidence\sde l['’]assemblée nationale\s+le (\d+|1er)\s+(.+)\.$/im;
        var match = re.exec(text);

        if (!match)
            return errorCallback(null);

        var day = match[1] == '1er' ? '1' : match[1];
        var month = months.indexOf(match[2]) + 1;

        return guessRecordingYear(legislature, number, day, month, successCallback, errorCallback);
    }

    var day = match[1] == '1er' ? '1' : match[1];
    var month = months.indexOf(match[2]) + 1;
    var year = match[3];

    return successCallback(new Date(year + '-' + month + '-' + day));
}
