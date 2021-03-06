export default class ReducerNode {
    constructor(name, {body, reduce}) {
        this.name = name;
        this.body = body;
        this.reduceFunction = reduce;
    }

    /**
     * When computing we also pass the parameters
     * 
     * @param {*} object 
     * @param {*} args 
     */
    compute(object, ...args) {
        object[this.name] = this.reduce.call(this, object, ...args);
    }

    reduce(object, ...args) {
        return this.reduceFunction.call(this, object, ...args);
    }
}