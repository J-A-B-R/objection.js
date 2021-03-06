var _ = require('lodash')
  , knex = require('knex')
  , expect = require('expect.js')
  , Promise = require('bluebird')
  , objection = require('../../../')
  , Model = objection.Model
  , QueryBuilder = objection.QueryBuilder
  , HasManyRelation = objection.HasManyRelation;

describe('HasManyRelation', function () {
  var originalKnexQueryBuilderThen = null;
  var mockKnexQueryResults = [];
  var executedQueries = [];
  var mockKnex = null;
  var OwnerModel = null;
  var RelatedModel = null;
  var relation;
  var compositeKeyRelation;

  before(function () {
    mockKnex = knex({client: 'pg'});
    originalKnexQueryBuilderThen = mockKnex.client.QueryBuilder.prototype.then;

    mockKnex.client.QueryBuilder.prototype.then = function (cb, ecb) {
      executedQueries.push(this.toString());
      return Promise.resolve(mockKnexQueryResults.shift() || []).then(cb, ecb);
    };
  });

  after(function () {
    mockKnex.client.QueryBuilder.prototype.then = originalKnexQueryBuilderThen;
  });

  beforeEach(function () {
    mockKnexQueryResults = [];
    executedQueries = [];

    OwnerModel = Model.extend(function OwnerModel () {
      Model.apply(this, arguments);
    });

    RelatedModel = Model.extend(function RelatedModel () {
      Model.apply(this, arguments);
    });

    OwnerModel.tableName = 'OwnerModel';
    OwnerModel.knex(mockKnex);

    RelatedModel.tableName = 'RelatedModel';
    RelatedModel.knex(mockKnex);
  });

  beforeEach(function () {
    relation = new HasManyRelation('nameOfOurRelation', OwnerModel);
    relation.setMapping({
      modelClass: RelatedModel,
      relation: HasManyRelation,
      join: {
        from: 'OwnerModel.oid',
        to: 'RelatedModel.ownerId'
      }
    });

    compositeKeyRelation = new HasManyRelation('nameOfOurRelation', OwnerModel);
    compositeKeyRelation.setMapping({
      modelClass: RelatedModel,
      relation: HasManyRelation,
      join: {
        from: ['OwnerModel.aid', 'OwnerModel.bid'],
        to: ['RelatedModel.ownerAId', 'RelatedModel.ownerBId']
      }
    });
  });

  describe('find', function () {

    it('should generate a find query', function () {
      var owner = OwnerModel.fromJson({oid: 666});
      var expectedResult = [
        {a: 1, ownerId: 666},
        {a: 2, ownerId: 666}
      ];

      mockKnexQueryResults = [expectedResult];

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .where('name', 'Teppo')
        .orWhere('age', '>', 60)
        .findImpl(function () {
          relation.find(this, [owner]);
        });

      return builder.then(function (result) {
        expect(result).to.have.length(2);
        expect(result).to.eql(expectedResult);
        expect(owner.nameOfOurRelation).to.eql(expectedResult);
        expect(result[0]).to.be.a(RelatedModel);
        expect(result[1]).to.be.a(RelatedModel);

        expect(executedQueries).to.have.length(1);
        expect(executedQueries[0]).to.equal(builder.toString());
        expect(executedQueries[0]).to.equal(builder.toSql());
        expect(executedQueries[0]).to.equal('select * from "RelatedModel" where "name" = \'Teppo\' or "age" > \'60\' and "RelatedModel"."ownerId" in (\'666\')');
      });
    });

    it('should generate a find query (composite key)', function () {
      var owners = [
        OwnerModel.fromJson({aid: 11, bid: 22}),
        OwnerModel.fromJson({aid: 11, bid: 33})
      ];

      var expectedResult = [
        {a: 1, ownerAId: 11, ownerBId: 22},
        {a: 2, ownerAId: 11, ownerBId: 22},
        {a: 3, ownerAId: 11, ownerBId: 33},
        {a: 4, ownerAId: 11, ownerBId: 33}
      ];

      mockKnexQueryResults = [expectedResult];

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .where('name', 'Teppo')
        .orWhere('age', '>', 60)
        .findImpl(function () {
          compositeKeyRelation.find(this, owners);
        });

      return builder.then(function (result) {
        expect(result).to.have.length(4);
        expect(result).to.eql(expectedResult);
        expect(owners[0].nameOfOurRelation).to.eql([{a: 1, ownerAId: 11, ownerBId: 22}, {a: 2, ownerAId: 11, ownerBId: 22}]);
        expect(owners[1].nameOfOurRelation).to.eql([{a: 3, ownerAId: 11, ownerBId: 33}, {a: 4, ownerAId: 11, ownerBId: 33}]);
        expect(result[0]).to.be.a(RelatedModel);
        expect(result[1]).to.be.a(RelatedModel);
        expect(result[2]).to.be.a(RelatedModel);
        expect(result[3]).to.be.a(RelatedModel);

        expect(executedQueries).to.have.length(1);
        expect(executedQueries[0]).to.equal(builder.toString());
        expect(executedQueries[0]).to.equal(builder.toSql());
        expect(executedQueries[0]).to.equal('select * from "RelatedModel" where "name" = \'Teppo\' or "age" > \'60\' and ("RelatedModel"."ownerAId", "RelatedModel"."ownerBId") in ((\'11\', \'22\'),(\'11\', \'33\'))');
      });
    });

    it('should find for multiple owners', function () {
      var owners = [
        OwnerModel.fromJson({oid: 666}),
        OwnerModel.fromJson({oid: 667})
      ];

      var expectedResult = [
        {a: 1, ownerId: 666},
        {a: 2, ownerId: 666},
        {a: 3, ownerId: 667},
        {a: 4, ownerId: 667}
      ];

      mockKnexQueryResults = [expectedResult];

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .where('name', 'Teppo')
        .orWhere('age', '>', 60)
        .findImpl(function () {
          relation.find(this, owners);
        });

      return builder.then(function (result) {
        expect(result).to.have.length(4);
        expect(result).to.eql(expectedResult);
        expect(owners[0].nameOfOurRelation).to.eql([{a: 1, ownerId: 666}, {a: 2, ownerId: 666}]);
        expect(owners[1].nameOfOurRelation).to.eql([{a: 3, ownerId: 667}, {a: 4, ownerId: 667}]);
        expect(result[0]).to.be.a(RelatedModel);
        expect(result[1]).to.be.a(RelatedModel);
        expect(result[2]).to.be.a(RelatedModel);
        expect(result[3]).to.be.a(RelatedModel);

        expect(executedQueries).to.have.length(1);
        expect(executedQueries[0]).to.equal(builder.toString());
        expect(executedQueries[0]).to.equal(builder.toSql());
        expect(executedQueries[0]).to.equal('select * from "RelatedModel" where "name" = \'Teppo\' or "age" > \'60\' and "RelatedModel"."ownerId" in (\'666\', \'667\')');
      });
    });

    it('explicit selects should override the RelatedModel.*', function () {
      var owner = OwnerModel.fromJson({oid: 666});
      var expectedResult = [
        {a: 1, ownerId: 666},
        {a: 2, ownerId: 666}
      ];

      mockKnexQueryResults = [expectedResult];

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .where('name', 'Teppo')
        .orWhere('age', '>', 60)
        .select('name')
        .findImpl(function () {
          relation.find(this, [owner]);
        });

      return builder.then(function (result) {
        expect(result).to.have.length(2);
        expect(result).to.eql(expectedResult);
        expect(owner.nameOfOurRelation).to.eql(expectedResult);
        expect(result[0]).to.be.a(RelatedModel);
        expect(result[1]).to.be.a(RelatedModel);

        expect(executedQueries).to.have.length(1);
        expect(executedQueries[0]).to.equal(builder.toString());
        expect(executedQueries[0]).to.equal(builder.toSql());
        expect(executedQueries[0]).to.equal('select "name" from "RelatedModel" where "name" = \'Teppo\' or "age" > \'60\' and "RelatedModel"."ownerId" in (\'666\')');
      });
    });

    it('should apply the filter', function () {
      createFilteredRelation({someColumn: 'foo'});

      var owner = OwnerModel.fromJson({oid: 666});
      var expectedResult = [
        {a: 1, ownerId: 666},
        {a: 2, ownerId: 666}
      ];

      mockKnexQueryResults = [expectedResult];

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .where('name', 'Teppo')
        .orWhere('age', '>', 60)
        .findImpl(function () {
          relation.find(this, [owner]);
        });

      return builder.then(function (result) {
        expect(result).to.have.length(2);
        expect(result).to.eql(expectedResult);
        expect(owner.nameOfOurRelation).to.eql(expectedResult);
        expect(result[0]).to.be.a(RelatedModel);
        expect(result[1]).to.be.a(RelatedModel);

        expect(executedQueries).to.have.length(1);
        expect(executedQueries[0]).to.equal(builder.toString());
        expect(executedQueries[0]).to.equal(builder.toSql());
        expect(executedQueries[0]).to.equal('select * from "RelatedModel" where "name" = \'Teppo\' or "age" > \'60\' and "RelatedModel"."ownerId" in (\'666\') and "someColumn" = \'foo\'');
      });
    });

  });

  describe('insert', function () {

    it('should generate an insert query', function () {
      mockKnexQueryResults = [[1, 2]];

      var owner = OwnerModel.fromJson({oid: 666});
      var related = [
        RelatedModel.fromJson({a: 'str1'}),
        RelatedModel.fromJson({a: 'str2'})
      ];

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .insertImpl(function (models) {
          relation.insert(this, owner, models);
        })
        .insert(related);

      var toString = builder.toString();
      var toSql = builder.toSql();

      return builder.then(function (result) {
        expect(executedQueries).to.have.length(1);
        expect(executedQueries[0]).to.equal(toString);
        expect(executedQueries[0]).to.equal(toSql);
        expect(executedQueries[0]).to.equal('insert into "RelatedModel" ("a", "ownerId") values (\'str1\', \'666\'), (\'str2\', \'666\') returning "id"');

        expect(owner.nameOfOurRelation).to.eql(result);
        expect(result).to.eql([
          {a: 'str1', id: 1, ownerId: 666},
          {a: 'str2', id: 2, ownerId: 666}
        ]);
        expect(result[0]).to.be.a(RelatedModel);
        expect(result[1]).to.be.a(RelatedModel);
      });
    });

    it('should generate an insert query (composite key)', function () {
      mockKnexQueryResults = [[1, 2]];

      var owner = OwnerModel.fromJson({aid: 11, bid: 22});
      var related = [
        RelatedModel.fromJson({a: 'str1'}),
        RelatedModel.fromJson({a: 'str2'})
      ];

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .insertImpl(function (models) {
          compositeKeyRelation.insert(this, owner, models);
        })
        .insert(related);

      var toString = builder.toString();
      var toSql = builder.toSql();

      return builder.then(function (result) {
        expect(executedQueries).to.have.length(1);
        expect(executedQueries[0]).to.equal(toString);
        expect(executedQueries[0]).to.equal(toSql);
        expect(executedQueries[0]).to.equal('insert into "RelatedModel" ("a", "ownerAId", "ownerBId") values (\'str1\', \'11\', \'22\'), (\'str2\', \'11\', \'22\') returning "id"');

        expect(owner.nameOfOurRelation).to.eql(result);
        expect(result).to.eql([
          {a: 'str1', id: 1, ownerAId: 11, ownerBId: 22},
          {a: 'str2', id: 2, ownerAId: 11, ownerBId: 22}
        ]);
        expect(result[0]).to.be.a(RelatedModel);
        expect(result[1]).to.be.a(RelatedModel);
      });
    });

    it('should accept json object array', function () {
      mockKnexQueryResults = [[1, 2]];

      var owner = OwnerModel.fromJson({oid: 666});
      var related = [{a: 'str1'}, {a: 'str2'}];

      return QueryBuilder
        .forClass(RelatedModel)
        .insertImpl(function (models) {
          relation.insert(this, owner, models);
        })
        .insert(related)
        .then(function (result) {
          expect(executedQueries).to.have.length(1);
          expect(executedQueries[0]).to.equal('insert into "RelatedModel" ("a", "ownerId") values (\'str1\', \'666\'), (\'str2\', \'666\') returning "id"');
          expect(result).to.eql([
            {a: 'str1', id: 1, ownerId: 666},
            {a: 'str2', id: 2, ownerId: 666}
          ]);
          expect(result[0]).to.be.a(RelatedModel);
          expect(result[1]).to.be.a(RelatedModel);
        });
    });

    it('should accept single model', function () {
      mockKnexQueryResults = [[1]];

      var owner = OwnerModel.fromJson({oid: 666});
      var related = RelatedModel.fromJson({a: 'str1'});

      return QueryBuilder
        .forClass(RelatedModel)
        .insertImpl(function (models) {
          relation.insert(this, owner, models);
        })
        .insert(related)
        .then(function (result) {
          expect(executedQueries).to.have.length(1);
          expect(executedQueries[0]).to.equal('insert into "RelatedModel" ("a", "ownerId") values (\'str1\', \'666\') returning "id"');
          expect(result).to.eql({a: 'str1', id: 1, ownerId: 666});
          expect(result).to.be.a(RelatedModel);
        });
    });

    it('should accept single json object', function () {
      mockKnexQueryResults = [[1]];

      var owner = OwnerModel.fromJson({oid: 666});
      var related = {a: 'str1'};

      return QueryBuilder
        .forClass(RelatedModel)
        .insertImpl(function (models) {
          relation.insert(this, owner, models);
        })
        .insert(related)
        .then(function (result) {
          expect(executedQueries).to.have.length(1);
          expect(executedQueries[0]).to.equal('insert into "RelatedModel" ("a", "ownerId") values (\'str1\', \'666\') returning "id"');
          expect(result).to.eql({a: 'str1', id: 1, ownerId: 666});
          expect(result).to.be.a(RelatedModel);
        });
    });

  });

  describe('update', function () {

    it('should generate an update query', function () {
      mockKnexQueryResults = [42];

      var owner = OwnerModel.fromJson({oid: 666});
      var update = RelatedModel.fromJson({a: 'str1'});

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .updateImpl(function (updt) {
          relation.update(this, owner, updt);
        })
        .update(update)
        .where('gender', 'male')
        .whereNotNull('thingy')
        .select('shouldBeIgnored');

      return builder.then(function (numUpdated) {
        expect(numUpdated).to.equal(42);
        expect(executedQueries).to.have.length(1);
        expect(executedQueries[0]).to.equal(builder.toString());
        expect(executedQueries[0]).to.equal(builder.toSql());
        expect(executedQueries[0]).to.eql('update "RelatedModel" set "a" = \'str1\' where "gender" = \'male\' and "thingy" is not null and "RelatedModel"."ownerId" in (\'666\')');
      });
    });

    it('should generate an update query (composite key)', function () {
      mockKnexQueryResults = [42];

      var owner = OwnerModel.fromJson({aid: 11, bid: 22});
      var update = RelatedModel.fromJson({a: 'str1'});

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .updateImpl(function (updt) {
          compositeKeyRelation.update(this, owner, updt);
        })
        .update(update)
        .where('gender', 'male')
        .whereNotNull('thingy')
        .select('shouldBeIgnored');

      return builder.then(function (numUpdated) {
        expect(numUpdated).to.equal(42);
        expect(executedQueries).to.have.length(1);
        expect(executedQueries[0]).to.equal(builder.toString());
        expect(executedQueries[0]).to.equal(builder.toSql());
        expect(executedQueries[0]).to.eql('update "RelatedModel" set "a" = \'str1\' where "gender" = \'male\' and "thingy" is not null and ("RelatedModel"."ownerAId", "RelatedModel"."ownerBId") in ((\'11\', \'22\'))');
      });
    });

    it('should accept json object', function () {
      mockKnexQueryResults = [42];

      var owner = OwnerModel.fromJson({oid: 666});
      var update = {a: 'str1'};

      return QueryBuilder
        .forClass(RelatedModel)
        .updateImpl(function (updt) {
          relation.update(this, owner, updt);
        })
        .update(update)
        .where('gender', 'male')
        .whereNotNull('thingy')
        .select('shouldBeIgnored')
        .then(function (numUpdated) {
          expect(numUpdated).to.equal(42);
          expect(executedQueries).to.have.length(1);
          expect(executedQueries[0]).to.eql('update "RelatedModel" set "a" = \'str1\' where "gender" = \'male\' and "thingy" is not null and "RelatedModel"."ownerId" in (\'666\')');
        });
    });

    it('should apply the filter', function () {
      mockKnexQueryResults = [42];

      createFilteredRelation({someColumn: 100});

      var owner = OwnerModel.fromJson({oid: 666});
      var update = RelatedModel.fromJson({a: 'str1'});

      return QueryBuilder
        .forClass(RelatedModel)
        .updateImpl(function (updt) {
          relation.update(this, owner, updt);
        })
        .update(update)
        .where('gender', 'male')
        .whereNotNull('thingy')
        .select('shouldBeIgnored')
        .then(function (numUpdated) {
          expect(numUpdated).to.equal(42);
          expect(executedQueries).to.have.length(1);
          expect(executedQueries[0]).to.eql('update "RelatedModel" set "a" = \'str1\' where "gender" = \'male\' and "thingy" is not null and "RelatedModel"."ownerId" in (\'666\') and "someColumn" = \'100\'');
        });
    });

  });

  describe('patch', function () {

    it('should generate a patch query', function () {
      mockKnexQueryResults = [42];

      var owner = OwnerModel.fromJson({oid: 666});
      var patch = RelatedModel.fromJson({a: 'str1'});

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .patchImpl(function (ptch) {
          relation.patch(this, owner, ptch);
        })
        .patch(patch)
        .where('gender', 'male')
        .whereNotNull('thingy')
        .select('shouldBeIgnored');

      return builder.then(function (numUpdated) {
        expect(numUpdated).to.equal(42);
        expect(executedQueries).to.have.length(1);
        expect(executedQueries[0]).to.equal(builder.toString());
        expect(executedQueries[0]).to.equal(builder.toSql());
        expect(executedQueries[0]).to.eql('update "RelatedModel" set "a" = \'str1\' where "gender" = \'male\' and "thingy" is not null and "RelatedModel"."ownerId" in (\'666\')');
      });
    });

    it('should accept json object', function () {
      mockKnexQueryResults = [42];

      RelatedModel.jsonSchema = {
        type: 'object',
        required: ['b'],
        properties: {
          a: {type: 'string'},
          b: {type: 'string'}
        }
      };

      var owner = OwnerModel.fromJson({oid: 666});
      var patch = {a: 'str1'};

      return QueryBuilder
        .forClass(RelatedModel)
        .patchImpl(function (ptch) {
          relation.patch(this, owner, ptch);
        })
        .patch(patch)
        .where('gender', 'male')
        .whereNotNull('thingy')
        .select('shouldBeIgnored')
        .then(function (numUpdated) {
          expect(numUpdated).to.equal(42);
          expect(executedQueries).to.have.length(1);
          expect(executedQueries[0]).to.eql('update "RelatedModel" set "a" = \'str1\' where "gender" = \'male\' and "thingy" is not null and "RelatedModel"."ownerId" in (\'666\')');
        });
    });

    it('should work with increment', function () {
      mockKnexQueryResults = [42];
      var owner = OwnerModel.fromJson({oid: 666});

      return QueryBuilder
        .forClass(RelatedModel)
        .patchImpl(function (ptch) {
          relation.patch(this, owner, ptch);
        })
        .increment('test', 1)
        .then(function (numUpdated) {
          expect(numUpdated).to.equal(42);
          expect(executedQueries).to.have.length(1);
          expect(executedQueries[0]).to.eql("update \"RelatedModel\" set \"test\" = \"test\" + '1' where \"RelatedModel\".\"ownerId\" in ('666')");
        });
    });

    it('should work with decrement', function () {
      mockKnexQueryResults = [42];
      var owner = OwnerModel.fromJson({oid: 666});

      return QueryBuilder
        .forClass(RelatedModel)
        .patchImpl(function (ptch) {
          relation.patch(this, owner, ptch);
        })
        .decrement('test', 10)
        .then(function (numUpdated) {
          expect(numUpdated).to.equal(42);
          expect(executedQueries).to.have.length(1);
          expect(executedQueries[0]).to.eql("update \"RelatedModel\" set \"test\" = \"test\" - '10' where \"RelatedModel\".\"ownerId\" in ('666')");
        });
    });

    it('should apply the filter', function () {
      createFilteredRelation({someColumn: 100});

      var owner = OwnerModel.fromJson({oid: 666});
      var patch = RelatedModel.fromJson({a: 'str1'});

      return QueryBuilder
        .forClass(RelatedModel)
        .patchImpl(function (patch) {
          relation.patch(this, owner, patch);
        })
        .patch(patch)
        .where('gender', 'male')
        .whereNotNull('thingy')
        .select('shouldBeIgnored')
        .then(function () {
          expect(executedQueries).to.have.length(1);
          expect(executedQueries[0]).to.eql('update "RelatedModel" set "a" = \'str1\' where "gender" = \'male\' and "thingy" is not null and "RelatedModel"."ownerId" in (\'666\') and "someColumn" = \'100\'');
        });
    });
  });

  describe('delete', function () {

    it('should generate a delete query', function () {
      var owner = OwnerModel.fromJson({oid: 666});

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .deleteImpl(function () {
          relation.delete(this, owner);
        })
        .delete()
        .where('gender', 'male')
        .whereNotNull('thingy')
        .select('shouldBeIgnored');

      return builder.then(function (result) {
        expect(executedQueries).to.have.length(1);
        expect(result).to.eql({});

        expect(executedQueries[0]).to.equal(builder.toString());
        expect(executedQueries[0]).to.equal(builder.toSql());
        expect(executedQueries[0]).to.eql('delete from "RelatedModel" where "gender" = \'male\' and "thingy" is not null and "RelatedModel"."ownerId" in (\'666\')');
      });
    });

    it('should generate a delete query (composite key)', function () {
      var owner = OwnerModel.fromJson({aid: 11, bid: 22});

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .deleteImpl(function () {
          compositeKeyRelation.delete(this, owner);
        })
        .delete()
        .where('gender', 'male')
        .whereNotNull('thingy')
        .select('shouldBeIgnored');

      return builder.then(function (result) {
        expect(executedQueries).to.have.length(1);
        expect(result).to.eql({});

        expect(executedQueries[0]).to.equal(builder.toString());
        expect(executedQueries[0]).to.equal(builder.toSql());
        expect(executedQueries[0]).to.eql('delete from "RelatedModel" where "gender" = \'male\' and "thingy" is not null and ("RelatedModel"."ownerAId", "RelatedModel"."ownerBId") in ((\'11\', \'22\'))');
      });
    });

    it('should apply the filter', function () {
      createFilteredRelation({someColumn: 100});
      var owner = OwnerModel.fromJson({oid: 666});

      return QueryBuilder
        .forClass(RelatedModel)
        .deleteImpl(function () {
          relation.delete(this, owner);
        })
        .delete()
        .where('gender', 'male')
        .whereNotNull('thingy')
        .select('shouldBeIgnored')
        .then(function (result) {
          expect(executedQueries).to.have.length(1);
          expect(result).to.eql({});
          expect(executedQueries[0]).to.eql('delete from "RelatedModel" where "gender" = \'male\' and "thingy" is not null and "RelatedModel"."ownerId" in (\'666\') and "someColumn" = \'100\'');
        });
    });

  });

  describe('relate', function () {

    it('should generate a relate query', function () {
      mockKnexQueryResults = [[5]];
      var owner = OwnerModel.fromJson({oid: 666});

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .relateImpl(function (ids) {
          relation.relate(this, owner, ids);
        })
        .relate(10);

      return builder.then(function (result) {
        expect(executedQueries).to.have.length(1);
        expect(result).to.eql(10);

        expect(executedQueries[0]).to.equal(builder.toString());
        expect(executedQueries[0]).to.equal(builder.toSql());
        expect(executedQueries[0]).to.eql('update "RelatedModel" set "ownerId" = \'666\' where "RelatedModel"."id" in (\'10\')');
      });
    });

    it('should generate a relate query (multiple ids)', function () {
      mockKnexQueryResults = [[5, 6, 7]];
      var owner = OwnerModel.fromJson({oid: 666});

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .relateImpl(function (ids) {
          relation.relate(this, owner, ids);
        })
        .relate([10, 20, 30]);

      return builder.then(function (result) {
        expect(executedQueries).to.have.length(1);
        expect(result).to.eql([10, 20, 30]);

        expect(executedQueries[0]).to.equal(builder.toString());
        expect(executedQueries[0]).to.equal(builder.toSql());
        expect(executedQueries[0]).to.eql('update "RelatedModel" set "ownerId" = \'666\' where "RelatedModel"."id" in (\'10\', \'20\', \'30\')');
      });
    });

    it('should generate a relate query (object value)', function () {
      mockKnexQueryResults = [[5]];
      var owner = OwnerModel.fromJson({oid: 666});

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .relateImpl(function (ids) {
          relation.relate(this, owner, ids);
        })
        .relate({id: 10});

      return builder.then(function (result) {
        expect(executedQueries).to.have.length(1);
        expect(result).to.eql({id: 10});

        expect(executedQueries[0]).to.equal(builder.toString());
        expect(executedQueries[0]).to.equal(builder.toSql());
        expect(executedQueries[0]).to.eql('update "RelatedModel" set "ownerId" = \'666\' where "RelatedModel"."id" in (\'10\')');
      });
    });

    it('should generate a relate query (array of object values)', function () {
      mockKnexQueryResults = [[5]];
      var owner = OwnerModel.fromJson({oid: 666});

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .relateImpl(function (ids) {
          relation.relate(this, owner, ids);
        })
        .relate([{id: 10}, {id: 20}]);

      return builder.then(function (result) {
        expect(executedQueries).to.have.length(1);
        expect(result).to.eql([{id: 10}, {id: 20}]);

        expect(executedQueries[0]).to.equal(builder.toString());
        expect(executedQueries[0]).to.equal(builder.toSql());
        expect(executedQueries[0]).to.eql('update "RelatedModel" set "ownerId" = \'666\' where "RelatedModel"."id" in (\'10\', \'20\')');
      });
    });

    it('should generate a relate query (composite key)', function () {
      mockKnexQueryResults = [[5, 6, 7]];
      var owner = OwnerModel.fromJson({aid: 11, bid: 22});

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .relateImpl(function (ids) {
          compositeKeyRelation.relate(this, owner, ids);
        })
        .relate([1, 2, 3]);

      return builder.then(function (result) {
        expect(executedQueries).to.have.length(1);
        expect(result).to.eql([1, 2, 3]);

        expect(executedQueries[0]).to.equal(builder.toString());
        expect(executedQueries[0]).to.equal(builder.toSql());
        expect(executedQueries[0]).to.eql('update "RelatedModel" set "ownerAId" = \'11\', "ownerBId" = \'22\' where "RelatedModel"."id" in (\'1\', \'2\', \'3\')');
      });
    });

    it('should accept one id', function () {
      mockKnexQueryResults = [[5]];
      var owner = OwnerModel.fromJson({oid: 666});

      return QueryBuilder
        .forClass(RelatedModel)
        .relateImpl(function (ids) {
          relation.relate(this, owner, ids);
        })
        .relate(11)
        .then(function (result) {
          expect(executedQueries).to.have.length(1);
          expect(result).to.eql(11);
          expect(executedQueries[0]).to.eql('update "RelatedModel" set "ownerId" = \'666\' where "RelatedModel"."id" in (\'11\')');
        });
    });

  });

  describe('unrelate', function () {

    it('should generate a unrelate query', function () {
      var owner = OwnerModel.fromJson({oid: 666});

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .unrelateImpl(function () {
          relation.unrelate(this, owner);
        })
        .unrelate()
        .whereIn('code', [55, 66 ,77]);

      return builder.then(function (result) {
        expect(executedQueries).to.have.length(1);
        expect(result).to.eql({});

        expect(executedQueries[0]).to.equal(builder.toString());
        expect(executedQueries[0]).to.equal(builder.toSql());
        expect(executedQueries[0]).to.eql('update "RelatedModel" set "ownerId" = NULL where "code" in (\'55\', \'66\', \'77\') and "RelatedModel"."ownerId" = \'666\'');
      });
    });

    it('should generate a unrelate query (composite key)', function () {
      var owner = OwnerModel.fromJson({aid: 11, bid: 22});

      var builder = QueryBuilder
        .forClass(RelatedModel)
        .unrelateImpl(function () {
          compositeKeyRelation.unrelate(this, owner);
        })
        .unrelate()
        .whereIn('code', [55, 66 ,77]);

      return builder.then(function (result) {
        expect(executedQueries).to.have.length(1);
        expect(result).to.eql({});

        expect(executedQueries[0]).to.equal(builder.toString());
        expect(executedQueries[0]).to.equal(builder.toSql());
        expect(executedQueries[0]).to.eql('update "RelatedModel" set "ownerAId" = NULL, "ownerBId" = NULL where "code" in (\'55\', \'66\', \'77\') and "RelatedModel"."ownerAId" = \'11\' and "RelatedModel"."ownerBId" = \'22\'');
      });
    });

    it('should apply the filter', function () {
      createFilteredRelation({someColumn: 100});
      var owner = OwnerModel.fromJson({oid: 666});

      return QueryBuilder
        .forClass(RelatedModel)
        .unrelateImpl(function () {
          relation.unrelate(this, owner);
        })
        .unrelate()
        .whereIn('code', [55, 66 ,77])
        .then(function (result) {
          expect(executedQueries).to.have.length(1);
          expect(result).to.eql({});
          expect(executedQueries[0]).to.eql('update "RelatedModel" set "ownerId" = NULL where "code" in (\'55\', \'66\', \'77\') and "RelatedModel"."ownerId" = \'666\' and "someColumn" = \'100\'');
        });
    });

  });

  function createFilteredRelation(filter) {
    relation = new HasManyRelation('nameOfOurRelation', OwnerModel);
    relation.setMapping({
      modelClass: RelatedModel,
      relation: HasManyRelation,
      filter: filter,
      join: {
        from: 'OwnerModel.oid',
        to: 'RelatedModel.ownerId'
      }
    });
  }
});
