var keystone = require('keystone');

var Bill = keystone.list('Bill');

const DELIMITERS = /(\s|\(|\)|\.|\!|'|’|,)/;
const KEYWORD_ARTICLE = 'Article';
const KEYWORD_NEW_ARTICLE = 'nouveau';
const KEYWORD_ARTICLE_REFERENCE = 'article';
const KEYWORDS = [
    KEYWORD_ARTICLE,
    KEYWORD_NEW_ARTICLE,
    KEYWORD_ARTICLE_REFERENCE
];

function tokenize(text) {
    return text.split(DELIMITERS)
        // remove all spaces
        // .filter(function(s) { return !s.match(/\s/); })
        // remove empty strings
        .filter(function(s) { return s != ''; });
}

function skipTokens(tokens, i, f) {
    while (i < tokens.length && f(tokens[i])) {
        ++i;
    }

    return i;
}

function skipSpaces(tokens, i) {
    return skipTokens(tokens, i, function(t) { return t.match(/\s+/); });
}

function skipToNextWord(tokens, i) {
    return skipTokens(tokens, i, function(t) { return !t.match(/\w/); });
}

function skipToToken(tokens, i, token) {
    return skipTokens(tokens, i, function(t) { return t != token; });
}

function skipToEndOfLine(tokens, i) {
    return skipToToken(tokens, i, '\n');
}

function isNumber(token) {
    return token.match(/\d+/);
}

function isSpace(token) {
    return !!token.match(/^\s+$/);
}

function trimSpaces(s) {
    // var m = s.match(/^\s*(.*[^\s])\s*$/);
    //
    // return m ? s.match(/^\s*(.*[^\s])\s*$/)[1] : s;
    return s.match(/^\s*(.*[^\s])\s*$/)[1];
}

function parseRomanNumber(number) {
    if (number == 'I') {
        return 1;
    } else if (number == 'II') {
        return 2;
    } else if (number == 'III') {
        return 3;
    } else if (number == 'IV') {
        return 4;
    } else if (number == 'V') {
        return 5;
    } else if (number == 'VI') {
        return 6;
    } else if (number == 'VII') {
        return 7;
    } else if (number == 'VIII') {
        return 8;
    }

    return -1;
}

function isRomanNumber(token) {
    return parseRomanNumber(token) != -1;
}

function wordToNumber(word) {
    if (word == 'premier') {
        return 1;
    }
    else if (word == 'second') {
        return 2;
    }
    else if (word == 'troisième') {
        return 3;
    }

    return -1;
}

function tokenIsArticleReference(tokens, i) {
    return tokens[i] == KEYWORD_ARTICLE_REFERENCE
        // && tokens[i + 1].match(/\s+/)
        // && tokens[i + 2] == 'L'
        // && tokens[i + 3] == '.'
        // && isSpace(tokens[i + 4])
        // && tokens[i + 5].match(/\d+(-[\d+])*/)
        // && isSpace(tokens[i + 6])
        // && tokens[i + 7] == 'du'
        // && isSpace(tokens[i + 8])
        // && tokens[i + 9] == 'code';
}

function monthToNumber(month) {
    var months = [
        'janvier',
        'février',
        'mars',
        'avril',
        'mai',
        'juin',
        'juillet',
        'août',
        'septembre',
        'octobre',
        'novembre',
        'décembre'];

    return months.indexOf(month) + 1;
}

function parseLawReference(tokens, i, parent) {
    var node = {
        type: 'law-reference',
        lawId: '',
        children: []
    };

    if (tokens[i].indexOf('loi') < 0) {
        return i;
    }

    // sip 'loi' and the following space
    i += 2;

    console.log('parse law ? ', tokens[i], tokens[i + 2], tokens[i + 4]);

    if (tokens[i] = 'organique') {

        i = skipToToken(tokens, i, 'n°') + 1;
        i = skipSpaces(tokens, i);

        node.lawType = 'organic';
        node.lawId = tokens[i];

        // skip {lawId} and the following space
        i += 2;
    }

    if (tokens[i] == 'du') {
        node.lawDate = tokens[i + 6] + '-' + monthToNumber(tokens[i + 4]) + '-' + tokens[i + 2];

        // skip {lawDate} and the following space
        i += 7;
    }

    parent.children.push(node);

    return i;
}

function parseArticleReference(tokens, i, parent) {
    // article {articleId} du code {codeName}, les mots :
    // article {articleId} du code {codeName} est ainsi modifié :
    var node = {
        type: 'article-reference',
        articleId: '',
        children: []
    };

    if (tokens[i].indexOf('article') < 0 && tokens[i] != 'L' && tokens[i + 1] != '.') {
        return i;
    }

    // sip 'article' and the following space
    i += 2;

    // article {articleId} de {lawReference}
    if (isNumber(tokens[i])) {
        node.articleId = parseInt(tokens[i]);

        if (tokens[i + 2] == 'de' && tokens[i + 6] == 'loi') {
            i = parseLawReference(tokens, i + 6, node);
        }
    }
    // article {articleId} du code {codeReference}
    else {
        for (; i < tokens.length && !tokens[i - 1].match(/\d+(-[\d+])*/); ++i) {
            node.articleId += tokens[i];
        }
        node.articleId = trimSpaces(node.articleId);

        i = skipSpaces(tokens, i);

        if (tokens[i] == 'du') {
            i = parseCodeReference(tokens, i + 2, node);
        }
    }

    parent.children.push(node);

    return i;
}

function parseArticleReferences(tokens, i, parent) {
    i = parseArticleReference(tokens, i, parent);
    i = skipSpaces(tokens, i);

    if (tokens[i] == 'et') {
        return parseArticleReference(tokens, i + 1, parent);
    }
}

function parseArticlePartReference(tokens, i, parent) {
    var node = {
        type: 'article-part-reference',
        children: []
    };

    // Au premier alinéa des articles
    if (tokens[i + 2] == 'alinéa') {
        node.partType = 'alinea';
        node.partNumber = wordToNumber(tokens[i]);

        i = skipTokens(tokens, i, function(t) { return t.indexOf('article') < 0 });
        i = parseArticleReferences(tokens, i, node);

        parent.children.push(node);
    }
    // A la fin du {article}
    else if (tokens[i] == 'la' && tokens[i + 2] == 'fin') {
        node.partType = 'article';
        node.partOffset = 'end';
        node.partNumber = parseRomanNumber(tokens[i + 6]);

        i = skipTokens(tokens, i, function(t) { return t.indexOf('article') < 0 });
        i = parseArticleReference(tokens, i, node);

        parent.children.push(node);
    }
    // Le {partNumber} de l’article {articleNumber} de {lawReference}
    else if (tokens[i].toLowerCase() == 'le' && isRomanNumber(tokens[i + 2])) {
        node.partType = 'article';
        node.partNumber = parseRomanNumber(tokens[i + 2]);

        // find 'article'
        i = skipTokens(tokens, i, function(t) { return t.indexOf('article') < 0 });
        i = parseArticleReference(tokens, i, node);

        parent.children.push(node);
    }

    return i;
}

function parseSentencePart(tokens, i, parent) {
    var node = {
        type: 'sentence-part',
        words: ''
    };

    i = skipTokens(tokens, i, function(t) { return t != '«' }) + 1;

    while (i < tokens.length && tokens[i] != '»') {
        node.words += tokens[i];
        ++i;
    }
    node.words = trimSpaces(node.words);

    // skip '»'
    ++i;

    parent.children.push(node);

    return i;
}

function parseArticleEdit(tokens, i, parent) {
    console.log('parseArticleEdit', tokens[i], tokens[i + 2], tokens[i + 4]);

    var node = {
        type: 'article-edit',
        children: []
    };

    // (Supprimé)
    if (tokens[i] == '(' && tokens[i + 1] == 'Supprimé' && tokens[i + 2] == ')') {
        node.editType = 'delete';

        i = skipToEndOfLine(tokens, i);

        parent.children.push(node);
    }
    // les mots : {sentencePartReference} sont {editType} ;
    else if (tokens[i].toLowerCase() == 'les' && isSpace(tokens[i + 1]) && tokens[i + 2] == 'mots') {
        i = parseSentencePart(tokens, i, node);
        i = skipSpaces(tokens, i);

        if (tokens[i + 2] == 'supprimés') {
            node.editType = 'delete';
        }

        i = skipToEndOfLine(tokens, i);

        parent.children.push(node);
    }
    else if (tokens[i].toLowerCase() == 'au') {
        i = skipSpaces(tokens, i + 1);
        i = parseArticlePartReference(tokens, i, node);
        // skip spaces and the ','
        i = parseSentencePart(tokens, i, node);
        i = skipToNextWord(tokens, i);
        if (tokens[i + 2].indexOf('remplacé') >= 0) {
            node.editType = 'replace';
        }
        i = parseSentencePart(tokens, i, node);
        i = skipToEndOfLine(tokens, i);

        parent.children.push(node);
    }
    // il est {editType.split('-')[0]} un {editType.split('-')[1]} ainsi rédigé :
    else if (tokens[i + 4] == 'ajouté') {
        node.editType = 'add';

        i = skipToToken(tokens, i, '«');
        i = parseSentencePart(tokens, i, node);
        i = skipToEndOfLine(tokens, i);

        parent.children.push(node);
    }
    // l'article {articleReference}
    else if (tokens[i].toLowerCase() == 'l' && tokens[i + 1] == '’' && tokens[i + 2] == 'article') {
        i = parseArticleReference(tokens, i + 2, node);
        i = skipSpaces(tokens, i);

        if (tokens[i] == 'est' && tokens[i + 2] == 'abrogé') {
            node.editType = 'delete';
        }
        else if (tokens[i] == 'est' && tokens[i + 4] == 'modifié') {
            i += 6;
            // L’article {articleRef} est ainsi {editType} :EOL
            if (tokens[i] == ':' && tokens[i + 1] == '\n') {
                node.editType = 'edit';
            }
            else {
                i = skipToToken(tokens, i, '«');
                i = parseSentencePart(tokens, i, node);
                i = skipSpaces(tokens, i);
                if (tokens[3].indexOf('supprimé') >= 0) {
                    node.editType = 'delete';
                }
            }
        }

        i = skipToEndOfLine(tokens, i);

        parent.children.push(node);
    }
    else if (tokens[i].toLowerCase() == 'à') {
        i = parseTargetReference(tokens, i + 2, node);
        i = skipToToken(tokens, i, '«');
        i = parseSentencePart(tokens, i, node);
        if (tokens[i + 3].indexOf('supprimé') >= 0) {
            node.editType = 'delete';
        }
        i = skipToEndOfLine(tokens, i);

        parent.children.push(node);
    }
    // Le code électoral est ainsi modifié :
    else if (tokens[i].toLowerCase() == 'le' && tokens[i + 2] == 'code') {
        i = parseCodeReference(tokens, i + 2, node);
        i = skipToEndOfLine(tokens, i);

        console.log('code', tokens[i], tokens[i + 2], tokens[i + 4]);

        node.editType = 'edit';

        parent.children.push(node);
    }
    // else if (tokens[i].toLowerCase() == 'le') {
    //     i = parseArticlePartReference(tokens, i, node);
    //     i = skipToToken(tokens, i, 'est') + 2;
    //
    //     if (tokens[i] == 'abrogé') {
    //         node.editType = 'delete';
    //     }
    //
    //     i = skipToEndOfLine(tokens, i);
    //
    //     parent.children.push(node);
    // }
    else {
        console.log('cannot understand edit');

        if (parent.isNewArticle && parent.children.length == 0) {
            node.editType = 'add';

            i = parseNewArticleContent(tokens, i, node);

            parent.children.push(node);
        }
    }

    return i;
}

function parseNewArticleContent(tokens, i, parent) {
    var node = {
        type: 'article-content',
        articleContent: ''
    };

    while (i < tokens.length && tokens[i] != '\n') {
        node.articleContent += tokens[i];
        ++i;
    }

    if (node.articleContent != '' && !isSpace(node.articleContent)) {
        parent.children.push(node);
    }

    return i;
}

function parseCodeReference(tokens, i, parent) {
    var node = {
        type: 'code-reference',
        codeName: ''
    };

    if (tokens[i] != 'code') {
        return i;
    }

    for (; i < tokens.length && tokens[i] != ',' && tokens[i] != 'est'; ++i) {
        node.codeName += tokens[i];
    }
    node.codeName = trimSpaces(node.codeName);

    if (node.codeName != '' && !isSpace(node.codeName)) {
        parent.children.push(node);
    }

    return i;
}

function parseTargetReference(tokens, i, parent) {
    i = skipSpaces(tokens, i);

    // L’article L. 260 du code électoral
    if (tokens[i].toLowerCase() == 'l' && tokens[i + 1] == '’' && tokens[i + 2] == 'article') {
        i = parseArticleReference(tokens, i, parent);
    }
    else if (tokens[i].toLowerCase() == 'le' && tokens[i + 2] == 'code') {
        i = parseCodeReference(tokens, i + 2, parent);
    }
    else {
        i = parseArticlePartReference(tokens, i, parent);
    }

    return i;
}

// {romanNumber}.
function parseArticleLevel1(tokens, i, parent) {
    console.log('parseArticleLevel1');

    i = skipSpaces(tokens, i);

    var node = {
        type: 'header-1',
        number: 0,
        children: []
    };

    // skip '{romanNumber}. - '
    if (isRomanNumber(tokens[i]) && tokens[i + 1] == '.') {
        node.number = parseRomanNumber(tokens[i]);

        i = skipToNextWord(tokens, i + 2);
    }

    i = parseArticleEdit(tokens, i, node);

    i = parseForEach(parseArticleLevel2, tokens, i, node);

    if (node.children.length) {
        parent.children.push(node);
    }

    return i;
}

// {number}°
function parseArticleLevel2(tokens, i, parent) {
    console.log('parseArticleLevel2');

    var node = {
        type: 'header-2',
        number: 0,
        children: []
    };

    i = skipSpaces(tokens, i);
    if (!!tokens[i].match(/\d+°/)) {
        node.number = parseInt(tokens[i]);

        i = parseArticleEdit(tokens, i += 2, node);

        if (node.children.length) {
            parent.children.push(node);
        }
    }
    // else {
    //     i = parseArticleEdit(tokens, i, node);
    // }


    return i;
}

function parseForEach(fn, tokens, i, parent) {
    var test = fn(tokens, i, parent);

    while (test != i) {
        i = test;
        test = fn(tokens, i, parent);
    }

    return i;
}

function parseArticle(tokens, i, parent) {
    var node = {
        type: 'article',
        children: []
    };

    i = skipSpaces(tokens, ++i);
    // read the article number and skip it
    node.articleNumber = parseInt(tokens[i++]);

    node.isNewArticle = false;
    var j = skipSpaces(tokens, i);
    if (tokens[j] == '(' && tokens[j + 1] == KEYWORD_NEW_ARTICLE && tokens[j + 2] == ')') {
        node.isNewArticle = true;
        i = j + 3;
    }

    console.log('article', node.articleNumber, ', new:', node.isNewArticle);

    // {romanNumber}.
    i = parseForEach(parseArticleLevel1, tokens, i, node);

    parent.children.push(node);

    return i;
}

function parse(tokens, i) {
    var node = {children: []};
    var current = node;
    var i = 0;

    while (i < tokens.length) {
        // if the KEYWORD_ARTICLE keyword is at the beginning of a line
        if (tokens[i - 1] == '\n' && tokens[i] == KEYWORD_ARTICLE) {
            i = parseArticle(tokens, ++i, current);
        }
        else {
            ++i;
        }
    }

    return node;
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

            var tokens = tokenize(bill.text);
            var ast = parse(tokens, 0);

            return res.apiResponse({
                ast:ast,
                // tokens:tokens
            });
        });
}
