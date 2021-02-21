module.exports = (obj, ...allowedFields) => {
    const newObj = {};
    allowedFields.forEach((el) => {
        if (obj[el]) newObj[el] = obj[el];
    });
    return newObj;
};
