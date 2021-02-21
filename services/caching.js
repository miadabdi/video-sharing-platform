const mongoose = require("mongoose");
const redis = require("redis");
const { promisify } = require('util');

const redisClient = redis.createClient(process.env.REDIS_CON_STRING, {
    db: parseInt(process.env.REDIS_DB_INDEX)
});
redisClient.get = promisify(redisClient.get);

const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.delAllCache = function() {
    this.deleteAllCache = true;
    return this;
}

mongoose.Query.prototype.delCache = function() {
    this.deleteCache = true;
    return this;
}

mongoose.Query.prototype.cache = function(ttl = 120, changes = {}) {
    this.useCaching = true;
    this.cacheTtl = ttl;
    this.cacheChanges = changes;
    return this;
}

mongoose.Query.prototype.exec = async function() {
    // if we dont wanna cache or delete cache we move on
    if(!this.useCaching && !this.deleteCache && !this.deleteAllCache) {
        return exec.apply(this, arguments);
    }

    if(this.deleteAllCache) {
        redisClient.flushdb();
        return exec.apply(this, arguments);
    }

    // creating a unique key
    const key = JSON.stringify(
        Object.assign(
            {}, 
            this.getFilter(), 
            { collection: this.mongooseCollection.name }
        )
    );

    // if we were instructed to delete cache
    if(this.deleteCache) {
        // delete the key-value and execute on mongo
        redisClient.del(key);
        return exec.apply(this, arguments);
    }

    // check if it exists in redis
    const resRedisQuery = await redisClient.get(key);
    if(resRedisQuery) {
        const docs = JSON.parse(resRedisQuery);

        // if any property is meant to increase or decrease
        // by retrieving, it will be passed in changes Object
        // like changes = {visits: 1} which increaments visits
        // property by one in redis server in every retrieval
        if(this.cacheChanges) {
            // if the saved value(retrieved value from mongo) is an array
            if (Array.isArray(docs)) {
                // changing every document in the array
                docs.forEach(doc => {
                    // changing every property that is in changes
                    Object.keys(this.cacheChanges).forEach(key => {
                        doc[key] += this.cacheChanges[key];
                    });
                });
            } else {
                // changing every property that is in changes
                Object.keys(this.cacheChanges).forEach(key => {
                    docs[key] += this.cacheChanges[key];
                });
            }

            // after increament or decreamenting, will save the changes
            redisClient.set(key, JSON.stringify(docs), 'EX', this.cacheTtl);
        }

        // Why do we send back increament one if we also increament this on other files?
        // this cached value which is increased already will be increased again
        // in the function that called this. the reason we put the following code after
        // above code(which returns the increamented version) is becuase, the first time
        // we cache this value, it will be increased in the db but not in redis.
        // so, next time we first increase then return the value

        // converting retreived object or array of objects to mongoose.document
        let modelInstances; 
        if(Array.isArray(docs)) {
            modelInstances = Array.map(doc => { 
                const tempDoc = new this.model(doc);
                tempDoc.isNew = false;
                return tempDoc;
            });
        } else {
            modelInstances = new this.model(docs);
            // is isNew is set to false, mongoose wont try to insert this document
            // simply, it thinks the document already exists in mongo and just updates it
            modelInstances.isNew = false;
        }

        return modelInstances;
    }

    // if it does not exist in redis, get from mongo
    const resMongoQuery = await exec.apply(this, arguments);

    if (resMongoQuery) {
        // if the result is null, we dont cache it
        redisClient.set(key, JSON.stringify(resMongoQuery), 'EX', this.cacheTtl);
    }

    return resMongoQuery;
}