/**
 * Value Conversion Utilities
 *
 * Bidirectional conversion between JavaScript values and Firestore REST format.
 */

import {
    type FieldValueType,
    getArrayRemoveElements,
    getArrayUnionElements,
    getIncrementAmount,
    isArrayRemove,
    isArrayUnion,
    isDeleteField,
    isFieldValue,
    isIncrement,
    isServerTimestamp,
} from "./field-value.js";
import type {
    ArrayValue,
    FieldTransform,
    FirestoreValue,
    MapValue,
} from "./types.js";
import { quoteFieldPath, quoteFieldPathSegment } from "./utils.js";

// Re-export from field-value
export {
    FieldValue,
    isFieldValue,
    type FieldValueType,
} from "./field-value.js";

// ============================================================================
// GeoPoint Class
// ============================================================================

/**
 * Represents a geographic point (latitude/longitude).
 */
export class GeoPoint {
    constructor(
        readonly latitude: number,
        readonly longitude: number,
    ) {
        if (latitude < -90 || latitude > 90) {
            throw new Error("Latitude must be between -90 and 90");
        }
        if (longitude < -180 || longitude > 180) {
            throw new Error("Longitude must be between -180 and 180");
        }
    }

    isEqual(other: GeoPoint): boolean {
        return (
            this.latitude === other.latitude &&
            this.longitude === other.longitude
        );
    }
}

// ============================================================================
// Timestamp Class
// ============================================================================

/**
 * Represents a Firestore timestamp with nanosecond precision.
 */
export class Timestamp {
    constructor(
        readonly seconds: number,
        readonly nanoseconds: number,
    ) {}

    static now(): Timestamp {
        const now = Date.now();
        return new Timestamp(Math.floor(now / 1000), (now % 1000) * 1_000_000);
    }

    static fromDate(date: Date): Timestamp {
        const ms = date.getTime();
        return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1_000_000);
    }

    static fromMillis(milliseconds: number): Timestamp {
        return new Timestamp(
            Math.floor(milliseconds / 1000),
            (milliseconds % 1000) * 1_000_000,
        );
    }

    toDate(): Date {
        return new Date(this.seconds * 1000 + this.nanoseconds / 1_000_000);
    }

    toMillis(): number {
        return this.seconds * 1000 + this.nanoseconds / 1_000_000;
    }

    isEqual(other: Timestamp): boolean {
        return (
            this.seconds === other.seconds &&
            this.nanoseconds === other.nanoseconds
        );
    }
}

// ============================================================================
// JavaScript to Firestore Conversion
// ============================================================================

/**
 * Convert a JavaScript value to Firestore REST format.
 */
export function toFirestoreValue(value: unknown): FirestoreValue {
    // null
    if (value === null) {
        return { nullValue: null };
    }

    // undefined -> null
    if (value === undefined) {
        return { nullValue: null };
    }

    // boolean
    if (typeof value === "boolean") {
        return { booleanValue: value };
    }

    // number
    if (typeof value === "number") {
        if (Number.isInteger(value)) {
            return { integerValue: String(value) };
        }
        return { doubleValue: value };
    }

    // string
    if (typeof value === "string") {
        return { stringValue: value };
    }

    // Date
    if (value instanceof Date) {
        return { timestampValue: value.toISOString() };
    }

    // Timestamp
    if (value instanceof Timestamp) {
        return { timestampValue: value.toDate().toISOString() };
    }

    // GeoPoint
    if (value instanceof GeoPoint) {
        return {
            geoPointValue: {
                latitude: value.latitude,
                longitude: value.longitude,
            },
        };
    }

    // Uint8Array (bytes)
    if (value instanceof Uint8Array) {
        // Convert to base64
        const binary = Array.from(value, (byte) =>
            String.fromCharCode(byte),
        ).join("");
        return { bytesValue: btoa(binary) };
    }

    // Array
    if (Array.isArray(value)) {
        return {
            arrayValue: {
                values: value.map(toFirestoreValue),
            },
        };
    }

    // Object (map)
    if (typeof value === "object") {
        const fields: Record<string, FirestoreValue> = {};
        for (const [key, val] of Object.entries(value)) {
            // Skip FieldValue sentinels - they're handled separately as transforms
            if (!isFieldValue(val)) {
                fields[key] = toFirestoreValue(val);
            }
        }
        return {
            mapValue: {
                fields,
            },
        };
    }

    throw new Error(`Unsupported value type: ${typeof value}`);
}

/**
 * Convert document data to Firestore fields format.
 */
export function toFirestoreFields(
    data: Record<string, unknown>,
): Record<string, FirestoreValue> {
    const fields: Record<string, FirestoreValue> = {};
    for (const [key, value] of Object.entries(data)) {
        if (!isFieldValue(value)) {
            fields[key] = toFirestoreValue(value);
        }
    }
    return fields;
}

/**
 * Extract field transforms from document data.
 */
export function extractFieldTransforms(
    data: Record<string, unknown>,
    pathPrefix = "",
): FieldTransform[] {
    const transforms: FieldTransform[] = [];

    for (const [key, value] of Object.entries(data)) {
        const quotedKey = key.includes(".")
            ? quoteFieldPath(key)
            : quoteFieldPathSegment(key);
        const fieldPath = pathPrefix ? `${pathPrefix}.${quotedKey}` : quotedKey;

        if (isFieldValue(value)) {
            const transform = fieldValueToTransform(value, fieldPath);
            if (transform) {
                transforms.push(transform);
            }
        } else if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value) &&
            !(value instanceof Date) &&
            !(value instanceof Timestamp) &&
            !(value instanceof GeoPoint) &&
            !(value instanceof Uint8Array)
        ) {
            // Recurse into nested objects
            transforms.push(
                ...extractFieldTransforms(
                    value as Record<string, unknown>,
                    fieldPath,
                ),
            );
        }
    }

    return transforms;
}

/**
 * Convert a FieldValue sentinel to a FieldTransform.
 */
function fieldValueToTransform(
    fieldValue: FieldValueType,
    fieldPath: string,
): FieldTransform | null {
    if (isServerTimestamp(fieldValue)) {
        return {
            fieldPath,
            setToServerValue: "REQUEST_TIME",
        };
    }

    if (isDeleteField(fieldValue)) {
        // Delete is handled differently - not a transform
        return null;
    }

    if (isIncrement(fieldValue)) {
        return {
            fieldPath,
            increment: toFirestoreValue(getIncrementAmount(fieldValue)),
        };
    }

    if (isArrayUnion(fieldValue)) {
        const elements = getArrayUnionElements(fieldValue) ?? [];
        return {
            fieldPath,
            appendMissingElements: {
                values: elements.map(toFirestoreValue),
            },
        };
    }

    if (isArrayRemove(fieldValue)) {
        const elements = getArrayRemoveElements(fieldValue) ?? [];
        return {
            fieldPath,
            removeAllFromArray: {
                values: elements.map(toFirestoreValue),
            },
        };
    }

    return null;
}

/**
 * Extract delete field paths from document data.
 */
export function extractDeleteFields(
    data: Record<string, unknown>,
    pathPrefix = "",
): string[] {
    const deletePaths: string[] = [];

    for (const [key, value] of Object.entries(data)) {
        const quotedKey = key.includes(".")
            ? quoteFieldPath(key)
            : quoteFieldPathSegment(key);
        const fieldPath = pathPrefix ? `${pathPrefix}.${quotedKey}` : quotedKey;

        if (isFieldValue(value) && isDeleteField(value)) {
            deletePaths.push(fieldPath);
        } else if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value) &&
            !(value instanceof Date) &&
            !(value instanceof Timestamp) &&
            !(value instanceof GeoPoint) &&
            !(value instanceof Uint8Array)
        ) {
            deletePaths.push(
                ...extractDeleteFields(
                    value as Record<string, unknown>,
                    fieldPath,
                ),
            );
        }
    }

    return deletePaths;
}

/**
 * Extract transform field paths from document data.
 * These are fields with FieldValue sentinels that become transforms (not delete).
 */
export function extractTransformFields(
    data: Record<string, unknown>,
    pathPrefix = "",
): string[] {
    const transformPaths: string[] = [];

    for (const [key, value] of Object.entries(data)) {
        const quotedKey = key.includes(".")
            ? quoteFieldPath(key)
            : quoteFieldPathSegment(key);
        const fieldPath = pathPrefix ? `${pathPrefix}.${quotedKey}` : quotedKey;

        if (isFieldValue(value) && !isDeleteField(value)) {
            transformPaths.push(fieldPath);
        } else if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value) &&
            !(value instanceof Date) &&
            !(value instanceof Timestamp) &&
            !(value instanceof GeoPoint) &&
            !(value instanceof Uint8Array)
        ) {
            transformPaths.push(
                ...extractTransformFields(
                    value as Record<string, unknown>,
                    fieldPath,
                ),
            );
        }
    }

    return transformPaths;
}

// ============================================================================
// Firestore to JavaScript Conversion
// ============================================================================

/**
 * Convert a Firestore REST value to JavaScript.
 */
export function fromFirestoreValue(value: FirestoreValue): unknown {
    if ("nullValue" in value) {
        return null;
    }

    if ("booleanValue" in value) {
        return value.booleanValue;
    }

    if ("integerValue" in value) {
        return parseInt(value.integerValue, 10);
    }

    if ("doubleValue" in value) {
        return value.doubleValue;
    }

    if ("timestampValue" in value) {
        return new Date(value.timestampValue);
    }

    if ("stringValue" in value) {
        return value.stringValue;
    }

    if ("bytesValue" in value) {
        // Decode base64
        const binary = atob(value.bytesValue);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    if ("referenceValue" in value) {
        return value.referenceValue;
    }

    if ("geoPointValue" in value) {
        return new GeoPoint(
            value.geoPointValue.latitude,
            value.geoPointValue.longitude,
        );
    }

    if ("arrayValue" in value) {
        const arr = value as ArrayValue;
        return (arr.arrayValue.values ?? []).map(fromFirestoreValue);
    }

    if ("mapValue" in value) {
        const map = value as MapValue;
        return fromFirestoreFields(map.mapValue.fields ?? {});
    }

    throw new Error("Unknown Firestore value type");
}

/**
 * Convert Firestore fields to JavaScript object.
 */
export function fromFirestoreFields(
    fields: Record<string, FirestoreValue>,
): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
        result[key] = fromFirestoreValue(value);
    }
    return result;
}
