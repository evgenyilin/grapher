import CollectionNode from '../nodes/collectionNode.js';
import FieldNode from '../nodes/fieldNode.js';
import ReducerNode from '../nodes/reducerNode.js';
import dotize from './dotize.js';
import createReducers from '../reducers/lib/createReducers';

const specialFields = [
    '$filters',
    '$options',
    '$postFilters',
    '$postOptions',
    '$postFilter'
];

/**
 * Creates node objects from the body. The root is always a collection node.
 *
 * @param root
 */
export function createNodes(root) {
    // this is a fix for phantomjs tests (don't really understand it.)
    if (!_.isObject(root.body)) {
        return;
    }

    _.each(root.body, (body, fieldName) => {
        if (!body) {
            return;
        }

        // if it's a prop
        if (_.contains(specialFields, fieldName)) {
            root.addProp(fieldName, body);

            return;
        }

        // workaround, see https://github.com/cult-of-coders/grapher/issues/134
        // TODO: find another way to do this
        if (root.collection.default) {
          root.collection = root.collection.default;
        }

        // checking if it is a link.
        let linker = root.collection.getLinker(fieldName);

        if (linker) {
            // check if it is a cached link
            // if yes, then we need to explicitly define this at collection level
            // so when we transform the data for delivery, we move it to the link name
            if (linker.isDenormalized()) {
                if (linker.isSubBodyDenormalized(body)) {
                    handleDenormalized(root, linker, body, fieldName);
                    return;
                }
            }

            let subroot = new CollectionNode(linker.getLinkedCollection(), body, fieldName);
            root.add(subroot, linker);

            createNodes(subroot);
            return;
        }

        // checking if it's a reducer
        const reducer = root.collection.getReducer(fieldName);

        if (reducer) {
            let reducerNode = new ReducerNode(fieldName, reducer);
            root.add(reducerNode);
        }

        // it's most likely a field then
        addFieldNode(body, fieldName, root);
    });

    createReducers(root);

    if (root.fieldNodes.length === 0) {
        root.add(new FieldNode('_id', 1));
    }
}

/**
 * @param body
 * @param fieldName
 * @param root
 */
export function addFieldNode(body, fieldName, root) {
    // it's not a link and not a special variable => we assume it's a field
    if (_.isObject(body)) {
        let dotted = dotize.convert({[fieldName]: body});
        _.each(dotted, (value, key) => {
            root.add(new FieldNode(key, value));
        });
    } else {
        let fieldNode = new FieldNode(fieldName, body);
        root.add(fieldNode);
    }
}

/**
 * @param collection
 * @param body
 * @returns {CollectionNode}
 */
export default function (collection, body) {
    let root = new CollectionNode(collection, body);
    createNodes(root);

    return root;
};

/**
 * Ads denormalization config properly, including _id
 *
 * @param root
 * @param linker
 * @param body
 * @param fieldName
 */
function handleDenormalized(root, linker, body, fieldName) {
    Object.assign(body, {_id: 1});

    const cacheField = linker.linkConfig.denormalize.field;
    root.snapCache(cacheField, fieldName);

    // if it's one and direct also include the link storage
    if (!linker.isMany() && !linker.isVirtual()) {
        addFieldNode(1, linker.linkStorageField, root);
    }

    addFieldNode(body, cacheField, root);
}