const excludeFields = (orgObj, excludingFields) => {
    const newObj = {};
    Object.keys(orgObj).forEach((el) => {
        if (!excludingFields.includes(el)) newObj[el] = orgObj[el];
    });
    return newObj;
};

class APIFeatures {
    constructor(model, queryOptions) {
        this.model = model;
        this.queryOptions = queryOptions;
    }

    filter() {
        // This method should always be called and should be the first to be called

        const excludingFields = ["sort", "page", "limit", "fields"];
        let filter = excludeFields(this.queryOptions, excludingFields);

        // gte gt lte lt => $gte $gt $lte $lt
        filter = JSON.parse(
            JSON.stringify(filter).replace(/\b(gt|gte|lt|lte)\b/g, (val) => `$${val}`)
        );
        this.query = this.model.find(filter);
        return this;
    }

    paginate() {
        const page = this.queryOptions.page * 1 || 1;
        const limit = this.queryOptions.limit * 1 || 10;
        const skip = (page - 1) * limit;

        // skip: how many documents should be skipped
        this.query.skip(skip).limit(limit);
        return this;
    }

    excludeFields() {
        if (!this.queryOptions.fields || this.queryOptions.fields === "")
            this.queryOptions.fields = "-__v";

        this.query.select(this.queryOptions.fields.replace(/,/g, " "));
        return this;
    }

    sort() {
        if (!this.queryOptions.sort || this.queryOptions.sort === "")
            this.queryOptions.sort = "-createdAt";

        this.query.sort(this.queryOptions.sort.replace(",", " "));
        return this;
    }
}

module.exports = APIFeatures;