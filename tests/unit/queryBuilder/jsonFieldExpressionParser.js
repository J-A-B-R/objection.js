'use strict';

var _ = require('lodash')
  , expect = require('expect.js')
  , parser = require('../../../lib/queryBuilder/parsers/jsonFieldExpressionParser.js');

describe('jsonFieldExpressionParser', function () {

  // basic index and field references
  testParsing("col:[1]", ['col', 1]);
  testParsing("col:['1']", ['col', '1']);
  testParsing("col:[a]", ['col', 'a']);
  testParsing("col:['a']", ['col', 'a']);
  testParsing("col:a", ['col', 'a']);

  // less basic random babbling of test cases
  testParsing('123', ['123']);
  testParsing('123:abc', ['123', 'abc']);
  testParsing('123:[1].abc', ['123', 1, 'abc']);
  testParsing('123:[1.2].abc', ['123', '1.2', 'abc']);
  testParsing('col:[1.2][1].abc', ['col', '1.2', 1, 'abc']);
  testParsing('col:["1.2"][1].abc', ['col', '1.2', 1, 'abc']);
  testParsing("col:['1']", ['col', '1']);

  // with different quotes
  testParsing("col:['[1.2]'][1].abc", ['col', '[1.2]', 1, 'abc']);
  testParsing("col:['1']", ['col', '1']);

  // array reference having only quotes
  testParsing("col:[']", ['col', "'"]);
  testParsing("col:['']", ['col', "''"]);
  testParsing("col:[''']", ['col', "'''"]);

  testParsing('col:["]', ['col', '"']);
  testParsing('col:[""]', ['col', '""']);
  testParsing('col:["""]', ['col', '"""']);

  // array reference having quotes and brackets
  testParsing('col:field["nofa\'].il"]', ['col', 'field', "nofa'].il"]);
  testParsing("col:field['nofa\"].il']", ['col', 'field', 'nofa"].il']);

  // quotes in dotreference part
  testParsing("col:I'mCool", ['col', "I'mCool"]);
  testParsing('col:PleaseMindThe"Quote"', ['col', 'PleaseMindThe"Quote"']);

  // spaces in dotreference part
  testParsing('col:I work too [100]', ['col', 'I work too ', 100]);

  // new column reference style
  testParsing('MyCupOfTeaTable.cupOfTea:I work too [100]', ['MyCupOfTeaTable.cupOfTea', 'I work too ', 100]);

  // no column given
  testFail(':[]');
  testFail(':[nocolumn]');
  testFail(':["nocolumn"]');
  testFail(":['nocolumn']");
  testFail(':nocolumn');

  // invalid dotreference
  testFail("col:[1].");

  // trying to use index operator after dot
  testFail("col:wat.[1]");
  testFail("col:wat.['1']");
  testFail('col:wat.["1"]');
  testFail("col:wat[1].[1]");
  testFail("col:wat[1].['1']");
  testFail('col:wat[1].["1"]');

  // opening square bracket in dot ref
  testFail("col:a[1");
  testFail("col:a['1'");
  testFail('col:a["1"');
  testFail("col:[1].a[1");
  testFail("col:[1].a['1'");
  testFail('col:[1].a["1"');

  // closing square bracket in dot ref
  testFail("col:a]1");
  testFail("col:a]'1'");
  testFail('col:a]"1"');
  testFail("col:[1].a]1");
  testFail("col:[1].a]'1'");
  testFail('col:[1].a]"1"');

  // invalid array references
  testFail('col:wat[]');
  testFail("col:wat[");
  testFail("col:wat.a[");
  testFail("col:wat]");
  testFail("col:wat.a]");

  testFail('col:wat[fa[il]');
  testFail('col:wat[fa]il]');
  testFail('col:wat.field[fa[il]');
  testFail('col:wat.field[fa]il]');

  // these should fail because inside quotes there is same type of
  // quote => parser tries use stringWithoutSquareBrackets token
  // for parsing => bracket in key fails parsing
  testFail('col:field["fa"]il"]');
  testFail("col:field['fa']il']");

  describe("field expression parser's general options", function () {
    it("should fail if wrong start rule in parser options", function () {
      expect(function () {
        parser.parse('col', { startRule: 'undefined is not a function' })
      }).to.throwException();
    });

    it("should be able to give start rule as parameter", function () {
      var result = parser.parse('col', { startRule: 'start' });
      expect(result.columnName).to.be('col');
    });
  });
});

function testParsing(expr, expected) {
  it(expr, function () {
    var result = parser.parse(expr);
    var resultArray = [result.columnName].concat(_.pluck(result.access, 'ref'));
    expect(JSON.stringify(resultArray)).to.eql(JSON.stringify(expected));
  });
}

function testFail(expr) {
  it(expr + " should fail", function () {
    expect(function () {
      parser.parse(expr);
    }).to.throwException();
  });
}
