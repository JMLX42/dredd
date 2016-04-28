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

function skipToEndOfLine(tokens, i) {
    return skipTokens(tokens, i, function(t) { return t != '\n'; });
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

    i = skipTokens(tokens, i, function(t) { return t.indexOf('article') < 0 });
    for (i += 1; i < tokens.length && !tokens[i - 1].match(/\d+(-[\d+])*/); ++i) {
        node.articleId += tokens[i];
    }
    node.articleId = trimSpaces(node.articleId);

    i = skipSpaces(tokens, i);
    i = parseCodeReference(tokens, i, node);

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
    else if (tokens[i].toLowerCase() == 'à' && tokens[i + 2] == 'la' && tokens[i + 4] == 'fin') {
        node.partType = 'article';
        node.partOffset = 'end';
        node.partNumber = parseRomanNumber(tokens[i + 8]);

        i = parseArticleReference(tokens, i + 12, node);

        parent.children.push(node);
    }
    // Le II de l’article {articleNumber} de {billReference}
    else if (tokens[i].toLowerCase() == 'le' && isRomanNumber(tokens[i + 2])) {
        node.partType = 'article';
        node.partNumber = parseRomanNumber(tokens[i + 2]);
        // FIXME
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
    var node = {
        type: 'article-edit',
        children: []
    };

    i = skipSpaces(tokens, i);

    // les mots : {sentencePartReference} sont {editType} ;
    if (tokens[i].toLowerCase() == 'les' && isSpace(tokens[i + 1]) && tokens[i + 2] == 'mots') {
        i = parseSentencePart(tokens, i, node);
        i = skipSpaces(tokens, i);

        if (tokens[i + 2] == 'supprimés') {
            node.editType = 'delete-words';
        }
    }
    if (tokens[i].toLowerCase() == 'au') {
        i = parseArticlePartReference(tokens, i + 1, node);
        // skip spaces and the ','
        i = parseSentencePart(tokens, i, node);
        i = skipToNextWord(tokens, i);
        if (tokens[i + 2].indexOf('remplacé') >= 0) {
            node.editType = 'replace-words';
        }
        i = parseSentencePart(tokens, i, node);
    }
    // il est {editType.split('-')[0]} un {editType.split('-')[1]} ainsi rédigé :
    else if (tokens[i + 4] == 'ajouté') {
        if (tokens[i + 8] == 'alinéa') {
            node.editType = 'add-words';
        }

        i = parseSentencePart(tokens, i, node);
    }
    else if (tokens[i].toLowerCase() == 'l' && tokens[i + 1] == '’') {
        i = parseArticleReference(tokens, i + 2, node);
        i = skipSpaces(tokens, i);
        if (tokens[i] == 'est' && tokens[i + 2] == 'abrogé') {
            node.editType = 'delete-article';
        }
    }

    i = skipToEndOfLine(tokens, i);

    parent.children.push(node);

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

    var j = skipTokens(tokens, i, function(t) { return t != 'code' && t != '\n'; });
    if (tokens[j] != 'code') {
        return i;
    }

    for (; j < tokens.length && tokens[j] != ',' && tokens[j] != 'est'; ++j) {
        node.codeName += tokens[j];
    }
    node.codeName = trimSpaces(node.codeName);

    if (node.codeName != '' && !isSpace(node.codeName)) {
        parent.children.push(node);
    }

    return j;
}

function parseTargetReference(tokens, i, parent) {
    i = skipSpaces(tokens, i);

    // L’article L. 260 du code électoral
    if (tokens[i].toLowerCase() == 'l' && tokens[i + 1] == '’' && tokens[i + 2] == 'article') {
        return parseArticleReference(tokens, i, parent);
    }
    else {
        return parseArticlePartReference(tokens, i, parent);
    }

    return i;
}

// {romanNumber}.
function parseArticleLevel1(tokens, i, parent) {
    i = skipSpaces(tokens, i);

    // {romanNumber}.
    if (isRomanNumber(tokens[i]) && tokens[i] == '.') {
        i = skipToNextWord(tokens, i + 3);
        console.log(tokens[i]);
    }

    // if we could not read a target, then we must be at a new article or the end
    // of all articles ; so we should return
    var j = parseTargetReference(tokens, i, parent);
    if (j == i) {
        return i;
    }

    i = j;
    i = skipToEndOfLine(tokens, i);
    i = skipSpaces(tokens, i);

    // console.log(parent.isNewArticle);
    // if (parent.isNewArticle && i == parseForEach(parseArticleLevel2, tokens, i, parent)) {
    //     console.log('new article content');
    //     i = parseNewArticleContent(tokens, i, parent);
    // }
    // else {
        i = parseForEach(parseArticleLevel2, tokens, i, parent);
    // }


    return i;
}

// {number}°
function parseArticleLevel2(tokens, i, parent) {
    i = skipSpaces(tokens, i);
    if (!!tokens[i].match(/\d+°/)) {
        i = parseArticleEdit(tokens, i += 2, parent);
    }

    i = parseTargetReference(tokens, i, parent);

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
