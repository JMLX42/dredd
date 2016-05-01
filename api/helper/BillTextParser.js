const DELIMITERS = /(\s|\(|\)|\.|\!|'|’|,)/;
const KEYWORD_ARTICLE = 'Article';
const KEYWORD_NEW_ARTICLE = 'nouveau';
const KEYWORD_ARTICLE_REFERENCE = 'article';
const KEYWORD_PARTS = [
    'article', 'articles',
    'alinéa', 'alinéas',
    'phrase', 'phrases'
];
const KEYWORD_MONTH_NAMES = [
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
    'décembre'
];
const KEYWORDS = [
    KEYWORD_ARTICLE,
    KEYWORD_NEW_ARTICLE,
    KEYWORD_ARTICLE_REFERENCE
];

BillTextParser = function() {
    this._ast = null;
};

BillTextParser.prototype._tokenize = function(text) {
    return text.split(DELIMITERS)
        // remove all spaces
        // .filter(function(s) { return !s.match(/\s/); })
        // remove empty strings
        .filter(function(s) { return s != ''; });
}

BillTextParser.prototype._skipTokens = function(tokens, i, f) {
    while (i < tokens.length && f(tokens[i])) {
        ++i;
    }

    return i;
}

BillTextParser.prototype._skipSpaces = function(tokens, i) {
    return this._skipTokens(tokens, i, function(t) { return t.match(/\s+/); });
}

BillTextParser.prototype._skipToNextWord = function(tokens, i) {
    return this._skipTokens(tokens, i, function(t) { return !t.match(/\w/); });
}

BillTextParser.prototype._skipToToken = function(tokens, i, token) {
    return this._skipTokens(tokens, i, function(t) { return t != token; });
}

BillTextParser.prototype._skipToEndOfLine = function(tokens, i) {
    return this._skipToToken(tokens, i, '\n');
}

BillTextParser.prototype._skipToQuoteStart = function(tokens, i) {
    return this._skipToToken(tokens, i, '«');
}

BillTextParser.prototype._isNumber = function(token) {
    return token.match(/\d+/);
}

BillTextParser.prototype._isSpace = function(token) {
    return !!token.match(/^\s+$/);
}

BillTextParser.prototype._isArticlePart = function(token) {
    return KEYWORD_PARTS.indexOf(token) >= 0;
}

BillTextParser.prototype._trimSpaces = function(s) {
    var m = s.match(/^\s*(.*[^\s])\s*$/);

    return m ? s.match(/^\s*(.*[^\s])\s*$/)[1] : s;
}

BillTextParser.prototype._BillTextParseromanNumber = function(number) {
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

BillTextParser.prototype._isRomanNumber = function(token) {
    return this._BillTextParseromanNumber(token) != -1;
}

BillTextParser.prototype._isNumberWord = function(word) {
    return this._wordToNumber(word) >= 0;
}

BillTextParser.prototype._wordToNumber = function(word) {
    var words = [
        ['un', 'une', 'premier', 'première'],
        ['deux', 'deuxième', 'second', 'seconde'],
        ['trois', 'troisième'],
        ['quatre', 'quatrième'],
        ['cinq', 'cinquième'],
        ['six', 'sixième'],
        ['sept', 'septième'],
        ['huit', 'huitième'],
        ['neuf', 'neuvième']
    ];

    for (var i = 0; i < words.length; ++i) {
        if (words[i].indexOf(word) >= 0)
            return i + 1;
    }

    return -1;
}

BillTextParser.prototype._monthToNumber = function(month) {
    return KEYWORD_MONTH_NAMES.indexOf(month) + 1;
}

BillTextParser.prototype._createNode = function(parent, node) {
    node.parent = parent;
    parent.children.push(node);

    return node;
}

BillTextParser.prototype._removeNode = function(parent, node) {
    parent.children.splice(parent.children.indexOf(node), 1);
}

BillTextParser.prototype._deleteParent = function(root) {
    delete root.parent;

    if (root.children) {
        for (var child of root.children) {
            this._deleteParent(child);
        }
    }
}

BillTextParser.prototype._parseLawReference = function(tokens, i, parent) {

    if (tokens[i].indexOf('loi') < 0) {
        return i;
    }

    var node = this._createNode(parent, {
        type: 'law-reference',
        lawId: '',
        children: []
    });

    // sip 'loi' and the following space
    i += 2;

    if (tokens[i] = 'organique') {

        i = this._skipToToken(tokens, i, 'n°') + 1;
        i = this._skipSpaces(tokens, i);

        node.lawType = 'organic';
        node.lawId = tokens[i];

        // skip {lawId} and the following space
        i += 2;
    }

    if (tokens[i] == 'du') {
        node.lawDate = tokens[i + 6] + '-' + this._monthToNumber(tokens[i + 4]) + '-' + tokens[i + 2];

        // skip {lawDate} and the following space
        i += 7;
    }

    return i;
}

// article {articleId} du code {codeName}, les mots :
// article {articleId} du code {codeName} est ainsi modifié :
BillTextParser.prototype._parseArticleReference = function(tokens, i, parent) {
    console.log('parseArticleReference', '\t\t', tokens.slice(i, i + 10).join(''));

    if (tokens[i].indexOf('article') < 0 && tokens[i] != 'L' && tokens[i + 1] != '.') {
        return i;
    }

    var node = this._createNode(parent, {
        type: 'article-reference',
        articleId: '',
        children: []
    });

    // skip "l’article" and the following space
    if (tokens[i].toLowerCase() == 'l' && tokens[i + 1] == '’' && tokens[i + 2] == 'article') {
        i += 4;
    }
    // skip "article" and the following space
    else if (tokens[i].indexOf('article') >= 0) {
        i += 2;
    }

    // article {articleId} de {lawReference}
    if (this._isNumber(tokens[i])) {
        node.articleId = parseInt(tokens[i]);

        if (tokens[i + 2] == 'de' && tokens[i + 6] == 'loi') {
            i = this._parseLawReference(tokens, i + 6, node);
        }
    }
    // article {articleId} du code {codeReference}
    else {
        for (; i < tokens.length && !tokens[i - 1].match(/\d+(-[\d+])*/); ++i) {
            node.articleId += tokens[i];
        }
        node.articleId = this._trimSpaces(node.articleId);

        i = this._skipSpaces(tokens, i);

        if (tokens[i] == 'du') {
            i = this._parseCodeReference(tokens, i + 2, node);
        }
    }

    return i;
}

BillTextParser.prototype._parseArticlePartReference = function(tokens, i, parent) {
    console.log('parseArticlePartReference', '\t\t', tokens.slice(i, i + 10).join(''));

    var node = this._createNode(parent, {
        type: 'article-part-reference',
        children: [],
        parent: parent
    });

    // après
    if (tokens[i].toLowerCase() == 'après') {
        node.partOffset = 'after';
        i += 2;
    }
    // la fin du {article}
    else if (tokens[i] == 'la' && tokens[i + 2] == 'fin') {
        node.partOffset = 'end';
        i += 4;
    }
    // à la fin du {article}
    else if (tokens[i].toLowerCase() == 'à' && tokens[i + 2] == 'la' && tokens[i + 4] == 'fin') {
        node.partOffset = 'end';
        i += 6;
    }

    // de la {partNumber} {partType}
    if (tokens[i].toLowerCase() == 'de' && tokens[i + 2] == 'la' && this._isNumberWord(tokens[i + 4])) {

        i += 4;

        if (tokens[i + 2] == 'phrase') {
            node.partType == 'sentence';
            node.partNumber = this._wordToNumber(tokens[i]);

            i = this._parseArticlePartReference(tokens, i + 4, node);
        }
    }
    // le {partNumber} {partType}
    // du {partNumber} {partType}
    // un {partNumber} {partType}
    // au {partNumber} {partType}
    // la {partNumber} {partType}
    else if (['le', 'du', 'un', 'au', 'la'].indexOf(tokens[i].toLowerCase()) >= 0 && this._isNumberWord(tokens[i + 2])) {
        node.partNumber = this._wordToNumber(tokens[i + 2]);

        if (tokens[i + 4] == 'alinéa') {
            node.partType = 'alinea';
        }
        else if (tokens[i + 4] == 'phrase') {
            node.partType = 'sentence';
        }

        i = this._parseArticlePartReference(tokens, i + 6, node);
    }
    // le {partNumber}°
    // du {partNumber}°
    // un {partNumber}°
    // au {partNumber}°
    else if (['le', 'du', 'un', 'au'].indexOf(tokens[i].toLowerCase()) >= 0 && !!tokens[i + 2].match(/\d+°/)) {
        node.partType = 'header-2';
        node.partNumber = parseInt(tokens[i + 2]);

        i += 4;

        if (tokens[i] == 'bis') {
            node.isBis = true;
            i += 2;
        }
        else if (tokens[i] == 'ter') {
            node.isTer = true;
            i += 2;
        }

        i = this._parseArticlePartReference(tokens, i, node);

        // ainsi rédigé
        if (tokens[i + 2] == 'rédigé') {
            i = this._skipToQuoteStart(tokens, i + 2);
            i = this._parseForEach(this._parseQuote, tokens, i, node);
        }
    }
    // le {romanPartNumber}
    // du {romanPartNumber}
    else if (['le', 'du', 'un'].indexOf(tokens[i].toLowerCase()) >= 0 && this._isRomanNumber(tokens[i + 2])) {
        node.partType = 'header-1';
        node.partNumber = this._BillTextParseromanNumber(tokens[i + 2]);

        // find 'article'
        i = this._skipTokens(tokens, i, function(t) { return t.indexOf('article') < 0 });
        i = this._parseArticleReference(tokens, i, node);

        pushNode(parent, node);
    }
    // l'{partType} {partNumber}
    else if (tokens[i].toLowerCase() == 'l' && tokens[i + 1] == '’') {
        if (tokens[i + 2] == 'article') {
            i = this._parseArticleReference(tokens, i + 2, node);
        }
        else {
            i = this._parseArticlePartReference(tokens, i + 2, node);
        }
    }
    // de l'{partType} {partNumber}
    else if (tokens[i].toLowerCase() == 'de' && tokens[i + 2] == 'l' && tokens[i + 3] == '’') {
        if (tokens[i + 4] == 'article') {
            i = this._parseArticleReference(tokens, i + 4, node);
        }
        else {
            i = this._parseArticlePartReference(tokens, i + 4, node);
        }
    }
    // des {partType}
    // les {partType}
    else if (['des', 'les'].indexOf(tokens[i].toLowerCase()) >= 0) {
        // les mots
        if (tokens[i + 2] == 'mots') {
            node.partType = 'sentence';

            i = this._skipToQuoteStart(tokens, i);
            i = this._parseForEach(this._parseQuote, tokens, i, parent);
            i = this._skipSpaces(tokens, i);
        }
        else {
            i = this._parseArticleReference(tokens, i + 2, parent);
            i = this._skipSpaces(tokens, i);

            if (tokens[i] == 'et') {
                return this._parseArticleReference(tokens, i + 2, parent);
            }
        }
    }
    // {number} {partType}
    else if (this._isNumberWord(tokens[i].toLowerCase()) && this._isArticlePart(tokens[i + 2])) {
        if (tokens[i + 2].indexOf('alinéa') >= 0) {
            node.partType = 'alinea';
            i += 4;
        }
        else if (tokens[i + 2].indexOf('phrase') >= 0) {
            node.partType = 'sentence';
            i += 4;
        }
        else if (tokens[i + 2].indexOf('article') >= 0) {
            i = this._parseArticleReference(tokens, i + 2, node);
            console.log('foo', tokens.slice(i, i + 10).join(''));
        }

        // ainsi rédigé(e)
        if (tokens[i + 2].indexOf('rédigé') >= 0) {
            i = this._skipToQuoteStart(tokens, i + 2);
            i = this._parseForEach(this._parseQuote, tokens, i, node);
        }
    }
    // le même
    else if (['le'].indexOf(tokens[i].toLowerCase()) >= 0 && tokens[i + 2] == 'même') {
        // "le même {number} {part}" or "le même {part}"
        if (tokens[i + 4] == 'alinéa' || tokens[i + 6] == 'alinéa') {
            var alineas = this._searchNode(this._getRoot(parent), function(n) {
                return n.type == 'article-part-reference' && n.partType == 'alinea'
            });

            // the last one in order of traversal is the previous one in order of syntax
            node.children.push(alineas[alineas.length - 1]);

            node.partType = 'alinea';

            i += tokens[i + 4] == 'alinéa' ? 6 : 8;
        }
    }
    else {
        this._removeNode(parent, node);
    }

    return i;
}

BillTextParser.prototype._getRoot = function(node) {
    while (node.parent != null) {
        node = node.parent;
    }

    return node;
}

BillTextParser.prototype._searchNode = function(root, fn, results) {
    if (!results) {
        results = [];
    }

    if (fn(root)) {
        results.push(root);
    }

    if (root.children) {
        for (var child of root.children) {
            this._searchNode(child, fn, results);
        }
    }

    return results;
}

BillTextParser.prototype._parseQuote = function(tokens, i, parent) {
    if (tokens[i] != '«') {
        return i;
    }

    var node = this._createNode(parent, {
        type: 'quote',
        words: ''
    });

    // skip the '«'
    ++i;

    while (i < tokens.length && tokens[i] != '»' && tokens[i] != '\n') {
        node.words += tokens[i];
        ++i;
    }
    // node.words = node.words.replace(/«\s/g, '');
    node.words = this._trimSpaces(node.words);

    // skip '»'
    ++i;
    i = this._skipSpaces(tokens, i);

    return i;
}

BillTextParser.prototype._parseArticleEdit = function(tokens, i, parent) {
    console.log('parseArticleEdit', '\t\t', tokens.slice(i, i + 10).join(''));

    var node = this._createNode(parent, {
        type: 'article-edit',
        children: []
    });

    i = this._parseForEach(this._BillTextParsereference, tokens, i, node);
    // i = this._BillTextParsereference(tokens, i, node);
    i = this._skipToNextWord(tokens, i, node);

    // sont supprimés
    // est supprimé
    if (tokens[i + 2].indexOf('supprimé') >= 0) {
        node.editType = 'delete';

        i = this._skipToEndOfLine(tokens, i);
    }
    // est ainsi modifié
    else if (tokens[i + 4] == 'modifié') {
        node.editType = 'edit';

        i = this._skipToEndOfLine(tokens, i);
    }
    // est remplacé par
    // sont remplacés par
    else if (tokens[i + 2].indexOf('remplacé') >= 0) {
        node.editType = 'edit';

        // skip "est remplacé par" or "sont remplacé par"
        i += 6;

        i = this._BillTextParsereference(tokens, i, node);
    }
    // il est inséré
    // il est ajouté
    else if (tokens[i + 4] == 'inséré' || tokens[i + 4] == 'ajouté') {
        node.editType = 'add';

        i = this._BillTextParsereference(tokens, i + 6, node);
        i = this._skipToEndOfLine(tokens, i);
    }
    // est complété par
    else if (tokens[i + 2] == 'complété') {
        node.editType = 'add';

        i = this._BillTextParsereference(tokens, i + 6, node);
        i = this._skipToEndOfLine(tokens, i);
    }
    // est abrogé
    else if (tokens[i + 2] == 'abrogé') {
        node.editType = 'delete';

        i = this._skipToEndOfLine(tokens, i);
    }
    else if (parent.isNewArticle && parent.children.length == 0) {
        node.editType = 'add';

        i = this._parseNewArticleContent(tokens, i, node);
    }
    else {
        console.log('cannot understand edit', '\t\t', tokens.slice(i, i + 10).join(''));

        this._removeNode(parent, node);
    }

    return i;
}

BillTextParser.prototype._parseNewArticleContent = function(tokens, i, parent) {
    var node = this._createNode(parent, {
        type: 'article-content',
        articleContent: ''
    });

    while (i < tokens.length && tokens[i] != '\n') {
        node.articleContent += tokens[i];
        ++i;
    }

    if (node.articleContent == '' || this._isSpace(node.articleContent)) {
        this._removeNode(parent, node);
    }

    return i;
}

BillTextParser.prototype._parseCodeReference = function(tokens, i, parent) {
    var node = this._createNode(parent, {
        type: 'code-reference',
        codeName: ''
    });

    if (tokens[i] != 'code') {
        return i;
    }

    for (; i < tokens.length && tokens[i] != ',' && tokens[i] != 'est'; ++i) {
        node.codeName += tokens[i];
    }
    node.codeName = this._trimSpaces(node.codeName);

    if (node.codeName == '' || this._isSpace(node.codeName)) {
        this._removeNode(parent, node);
    }

    return i;
}

BillTextParser.prototype._BillTextParsereference = function(tokens, i, parent) {
    console.log('BillTextParsereference', tokens.slice(i, i + 5).join(''));
    // i = this._skipSpaces(tokens, i);
    i = this._skipToNextWord(tokens, i);

    // L’article L. 260 du code électoral
    if (tokens[i].toLowerCase() == 'l' && tokens[i + 1] == '’' && tokens[i + 2] == 'article') {
        i = this._parseArticleReference(tokens, i, parent);
    }
    else if (tokens[i].toLowerCase() == 'le' && tokens[i + 2] == 'code') {
        i = this._parseCodeReference(tokens, i + 2, parent);
    }
    else {
        i = this._parseArticlePartReference(tokens, i, parent);
    }

    return i;
}

// {romanNumber}.
// ex: I., II.
BillTextParser.prototype._parseArticleHeader1 = function(tokens, i, parent) {
    console.log('parseArticleHeader1');

    i = this._skipSpaces(tokens, i);

    var node = this._createNode(parent, {
        type: 'header-1',
        number: 0,
        children: []
    });

    // skip '{romanNumber}. - '
    if (this._isRomanNumber(tokens[i]) && tokens[i + 1] == '.') {
        node.number = this._BillTextParseromanNumber(tokens[i]);

        i = this._skipToNextWord(tokens, i + 2);
    }

    i = this._parseArticleEdit(tokens, i, node);
    i = this._parseForEach(this._parseArticleHeader2, tokens, i, node);

    if (node.children.length == 0) {
        this._removeNode(parent, node);
    }

    return i;
}

// {number}°
// ex: 1°, 2°
BillTextParser.prototype._parseArticleHeader2 = function(tokens, i, parent) {
    console.log('parseArticleHeader2', '\t\t', tokens.slice(i, i + 10).join(''));

    var node = this._createNode(parent, {
        type: 'header-2',
        number: 0,
        children: []
    });

    i = this._skipSpaces(tokens, i);
    if (!!tokens[i].match(/\d+°/)) {
        node.number = parseInt(tokens[i]);

        // skip {number}°
        i = this._skipToNextWord(tokens, i + 2);
    }

    i = this._parseArticleEdit(tokens, i, node);
    i = this._parseForEach(this._parseArticleHeader3, tokens, i, node);

    if (node.children.length == 0) {
        this._removeNode(parent, node);
    }

    return i;
}

// {number})
// ex: a), b), a (nouveau))
BillTextParser.prototype._parseArticleHeader3 = function(tokens, i, parent) {
    console.log('parseArticleHeader3', '\t\t', tokens.slice(i, i + 10).join(''));

    var node = this._createNode(parent, {
        type: 'header-3',
        number: 0,
        children: []
    });

    i = this._skipSpaces(tokens, i);
    var match = tokens[i].match(/([a-z]+)/);
    if (!!match && (tokens[i + 1] == ')' || (tokens[i + 2] == '(' && tokens[i + 5] == ')'))) {
        node.number = match[1].charCodeAt(0) - 'a'.charCodeAt(0);

        // skip '{number}) ' or '{number} (nouveau))'
        i += tokens[i + 1] == ')' ? 3 : 7;
        i = this._parseArticleEdit(tokens, i, node);
    }

    i = this._parseArticleEdit(tokens, i, node);

    if (node.children.length == 0) {
        this._removeNode(parent, node);
    }

    return i;
}

BillTextParser.prototype._parseForEach = function(fn, tokens, i, parent) {
    var test = fn.call(this, tokens, i, parent);

    while (test != i) {
        i = test;
        test = fn.call(this, tokens, i, parent);
    }

    return i;
}

BillTextParser.prototype._parseArticle = function(tokens, i, parent) {
    var node = this._createNode(parent, {
        type: 'article',
        children: []
    });

    i = this._skipSpaces(tokens, ++i);
    // read the article number and skip it
    node.articleNumber = parseInt(tokens[i]);

    // Article {number}bis
    if (!!tokens[i].match(/^.*bis$/)) {
        node.isBis = true;
    }
    else if (!!tokens[i].match(/^.*quater$/)) {
        node.isQuater = true;
    }
    else if (!!tokens[i].match(/^.*ter$/)) {
        node.isTer = true;
    }
    else if (!!tokens[i].match(/^.*quinquies$/)) {
        node.isQuinquies = true;
    }

    i++;

    node.isNewArticle = false;
    var j = this._skipSpaces(tokens, i);
    if (tokens[j] == '(' && tokens[j + 1] == KEYWORD_NEW_ARTICLE && tokens[j + 2] == ')') {
        node.isNewArticle = true;
        i = j + 3;
    }

    console.log('article', node.articleNumber, ', new:', node.isNewArticle);

    i = this._skipSpaces(tokens, i);

    // (Supprimé)
    if (tokens[i] == '(' && tokens[i + 1] == 'Supprimé' && tokens[i + 2] == ')') {

        node.isDeleted = true;

        i = this._skipToEndOfLine(tokens, i);

        return i;
    }

    // {romanNumber}.
    i = this._parseForEach(this._parseArticleHeader1, tokens, i, node);

    // pushNode(parent, node);

    return i;
}

BillTextParser.prototype.parse = function(text) {
    this._ast = {children: []};

    var current = this._ast;
    var tokens = this._tokenize(text);
    var i = 0;

    while (i < tokens.length) {
        // if the KEYWORD_ARTICLE keyword is at the beginning of a line
        if (tokens[i - 1] == '\n' && tokens[i] == KEYWORD_ARTICLE) {
            i = this._parseArticle(tokens, ++i, current);
        }
        else {
            ++i;
        }
    }

    return this._ast;
}

BillTextParser.prototype.getSerializableAST = function() {
    this._deleteParent(this._ast);

    return this._ast;
}

module.exports = BillTextParser;
