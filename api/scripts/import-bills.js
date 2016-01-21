var keystone = require('keystone');
var async = require('async');
var striptags = require('striptags');
var Entities = require('html-entities').AllHtmlEntities;
var iconv  = require('iconv-lite');
var request  = require('request');

var Bill = keystone.list('Bill');

module.exports = function(legislature, force, done)
{
    console.log('importing bills for legislature', legislature);

    var numErrors = 0;
    var numSkipped = 0;

    fetchBillNumbers(
        legislature,
        function(numbers)
        {
            console.log(numbers.length + ' bills to import');

            var numImportedBills = 0;

            var ops = numbers.map(function(number)
            {
                return function(callback)
                {
                    console.log(
                        '(' + ++numImportedBills + '/' + numbers.length
                        + ') importing bill ' + number
                    );
                    Bill.model.findOne({legislature : legislature, number : number})
                        .exec(function(err, bill)
                        {
                            if (err)
                                return callback(err);

                            if (!bill || force == 'true')
                            {
                                fetchBillMarkdown(
                                    legislature,
                                    number,
                                    function(text)
                                    {
                                        getRegistrationDate(
                                            legislature,
                                            number,
                                            text,
                                            function(registrationDate)
                                            {
                                                console.log(registrationDate)
                                                if (!bill)
                                                {
                                                    bill = Bill.model({
                                                        legislature: legislature,
                                                        number: number,
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
                                console.log('\tskip: already imported');

                                numSkipped++;

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
                    'total: ' + numbers.length
                    + ', success: ' + (numbers.length - numErrors - numSkipped)
                    + ', skipped: ' + numSkipped
                    + ', error: ' + numErrors
                );

                done();
            });
        }
    );
}

function fetchBillNumbers(legislature, callback)
{
    request(
        {
            uri: "http://www.assemblee-nationale.fr/"
                + legislature
                + "/documents/index-projets.asp"
        },
        function(error, response, body)
        {
            var projectAnchors = null;
            var re = new RegExp(
                '<a href="/' + legislature + '/projets/pl(\\\d+).asp"',
                'g'
            );

            var numbers = [];
            while ((projectAnchors = re.exec(body)) !== null)
                numbers.push(projectAnchors[1]);

            callback(numbers);
        }
    );
}

function fetchBillMarkdown(legislature, id, successCallback, errorCallback)
{
    request(
        {
            uri: "http://www.assemblee-nationale.fr/"
                + legislature
                + "/projets/pl"
                + id
                + ".asp",
            encoding: null
        },
        function(error, response, body)
        {
            var text = iconv.decode(new Buffer(body), "ISO-8859-1");
            var begin = text.indexOf(
                '<!-- Contenu -->',
                text.indexOf('<div style="margin-left: 2%; margin-right: 2%; margin-top: 2%; width: 95%">')
            );
            var end = text.indexOf('<hr size="1" noshade>');
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
    var re = /^\s*Enregistré à la présidence\sde l['’]Assemblée nationale\s+le (\d+|1er)\s+(.+)\s+(\d{4})\s*\.?$/im;
    var match = re.exec(text);

    if (!match)
    {
        // Sometimes, the year is not specified. So we will have to fetch the day & month
        // and guess the year based on those values + the values of the "next" bill.
        var re = /^\s*Enregistré à la présidence\sde l['’]Assemblée nationale\s+le (\d+|1er)\s+(.+)\.$/im;
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
