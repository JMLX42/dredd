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
                                    function(md)
                                    {
                                        var recordingDate = getRecordingDate(md);

                                        if (recordingDate === null)
                                            console.log('\terror: could not parse recording date');

                                        if (!bill)
                                        {
                                            bill = Bill.model({
                                                legislature: legislature,
                                                number: number,
                                                text: { md: md },
                                                recordingDate: recordingDate,
                                                importDate: Date.now()
                                            });
                                        }
                                        else
                                        {
                                            bill.md = md;
                                            bill.recordingDate = recordingDate;
                                            bill.importDate = Date.now();
                                        }
                                        console.log(getRecordingDate(md));

                                        bill.save(function(err)
                                        {
                                            console.log('\tok: imported');
                                            return callback(err);
                                        });
                                    },
                                    function(body)
                                    {
                                        console.log('\terror: could not parse text');

                                        numErrors++;

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
                numbers.push(parseInt(projectAnchors[1]));

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
                return errorCallback && errorCallback(body);

            text = text.substring(begin, end);

            // get only the actual text without the preamble
            // text = text.substring(
            //     text.indexOf('TITRE I<sup>ER</sup>'),
            //     text.indexOf('<hr size="1" noshade>')
            // );

            // replace <b> HTML tags with ** md tags
            text = text.replace(/<b>(\s*)(\S+.*)(\s*)<\/b>/g, '$1**$2**$3')
                .replace(/\*\*(\s)\*\*/g, '$1');

            // replace <i> HTML tags with * md tags
            text = text.replace(/<\/?i>/g, '*');

            // strip all HTML tags
            text = striptags(text);

            // remove horizontal rules made of undercores
            text = text.replace(/^\*\*_+\*\*$/gm, '');

            // replace em dash with md list
            text = text.replace(/^&#8211;/gm, '*');

            // decode HTML entities
            text = new Entities().decode(text);
            // remove Windows nl
            text = text.replace(/\r/gm, '');
            // trim whitespaces
            text = text.trim();

            // setup md headers
            text = text.replace(/^PROJET DE LOI/gm, '# PROJET DE LOI');
            text = text.replace(/^TITRE /gm, '## TITRE ');
            text = text.replace(/^Chapitre /gm, '### Chapitre ');
            text = text.replace(/^Section /gm, '#### Section ');
            text = text.replace(/^\*\*Article (.*)\*\*/gm, '##### Article $1');
            text = text.replace(/^([IXVCM]+)\./gm, '###### $1.');
            // text = text.replace(/^([0-9]+)°/gm, '####### $1°');

            successCallback(text);
        });
}

function getRecordingDate(md)
{
    var months = [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
        'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];
    var re = /^\s*Enregistré à la présidence\sde l['’]Assemblée nationale\s+le (\d+|1er)\s+(.+)\s+(\d{4})\s*\.?$/im;
    var match = re.exec(md);

    if (!match)
        return null;

    var day = match[1] == '1er' ? '1' : match[1];
    var month = months.indexOf(match[2]) + 1;
    var year = match[3];

    return new Date(year + '-' + month + '-' + day);
}
