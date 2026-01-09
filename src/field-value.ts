/**
 * FieldValue Sentinels
 *
 * Sentinel values for special Firestore operations.
 */

/** Property name to identify FieldValue instances */
const FIELD_VALUE_MARKER = "__isFieldValue__" as const;

/** Base class for FieldValue sentinels */
abstract class FieldValueBase {
    readonly __isFieldValue__: true = true;
    abstract readonly _type: string;
}

/** Server timestamp sentinel */
export class ServerTimestampValue extends FieldValueBase {
    readonly _type = "serverTimestamp";
}

/** Delete field sentinel */
export class DeleteFieldValue extends FieldValueBase {
    readonly _type = "delete";
}

/** Increment sentinel */
export class IncrementValue extends FieldValueBase {
    readonly _type = "increment";
    constructor(readonly amount: number) {
        super();
    }
}

/** Array union sentinel */
export class ArrayUnionValue extends FieldValueBase {
    readonly _type = "arrayUnion";
    constructor(readonly elements: unknown[]) {
        super();
    }
}

/** Array remove sentinel */
export class ArrayRemoveValue extends FieldValueBase {
    readonly _type = "arrayRemove";
    constructor(readonly elements: unknown[]) {
        super();
    }
}

/** FieldValue sentinel type */
export type FieldValueType =
    | ServerTimestampValue
    | DeleteFieldValue
    | IncrementValue
    | ArrayUnionValue
    | ArrayRemoveValue;

/**
 * FieldValue factory for creating sentinel values
 */
export const FieldValue = {
    /**
     * Returns a sentinel to include a server-generated timestamp in the written data.
     */
    serverTimestamp(): FieldValueType {
        return new ServerTimestampValue();
    },

    /**
     * Returns a sentinel to delete a field.
     */
    delete(): FieldValueType {
        return new DeleteFieldValue();
    },

    /**
     * Returns a sentinel to increment a numeric field by the given amount.
     */
    increment(amount: number): FieldValueType {
        return new IncrementValue(amount);
    },

    /**
     * Returns a sentinel to union elements into an array field.
     * Only adds elements not already present.
     */
    arrayUnion(...elements: unknown[]): FieldValueType {
        return new ArrayUnionValue(elements);
    },

    /**
     * Returns a sentinel to remove elements from an array field.
     */
    arrayRemove(...elements: unknown[]): FieldValueType {
        return new ArrayRemoveValue(elements);
    },
};

/**
 * Check if a value is a FieldValue sentinel
 */
export function isFieldValue(value: unknown): value is FieldValueType {
    return (
        typeof value === "object" &&
        value !== null &&
        FIELD_VALUE_MARKER in value &&
        value[FIELD_VALUE_MARKER] === true
    );
}

/**
 * Check if a value is a ServerTimestamp sentinel
 */
export function isServerTimestamp(
    value: unknown,
): value is ServerTimestampValue {
    return value instanceof ServerTimestampValue;
}

/**
 * Check if a value is a Delete sentinel
 */
export function isDeleteField(value: unknown): value is DeleteFieldValue {
    return value instanceof DeleteFieldValue;
}

/**
 * Check if a value is an Increment sentinel
 */
export function isIncrement(value: unknown): value is IncrementValue {
    return value instanceof IncrementValue;
}

/**
 * Get increment amount if value is an increment sentinel
 */
export function getIncrementAmount(value: unknown): number | undefined {
    if (value instanceof IncrementValue) {
        return value.amount;
    }
    return undefined;
}

/**
 * Check if a value is an ArrayUnion sentinel
 */
export function isArrayUnion(value: unknown): value is ArrayUnionValue {
    return value instanceof ArrayUnionValue;
}

/**
 * Get array union elements if value is an array union sentinel
 */
export function getArrayUnionElements(value: unknown): unknown[] | undefined {
    if (value instanceof ArrayUnionValue) {
        return value.elements;
    }
    return undefined;
}

/**
 * Check if a value is an ArrayRemove sentinel
 */
export function isArrayRemove(value: unknown): value is ArrayRemoveValue {
    return value instanceof ArrayRemoveValue;
}

/**
 * Get array remove elements if value is an array remove sentinel
 */
export function getArrayRemoveElements(value: unknown): unknown[] | undefined {
    if (value instanceof ArrayRemoveValue) {
        return value.elements;
    }
    return undefined;
}
