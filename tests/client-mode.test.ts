import { describe, expect, it, vi } from "vitest";
import { Firestore } from "../src/client.js";

// Mock global fetch
const globalFetch = vi.fn();
global.fetch = globalFetch;

describe("Firestore Client - Token Config", () => {
    it("should use the provided token function", async () => {
        const token = "dynamic-token-456";
        const tokenFn = vi.fn().mockResolvedValue(token);
        const projectId = "test-project";
        const client = new Firestore({
            projectId,
            token: tokenFn,
        });

        // Mock a successful response
        globalFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                name: `projects/${projectId}/databases/(default)/documents/users/user1`,
                fields: {},
            }),
        });

        await client._getDocument("users/user1");

        expect(tokenFn).toHaveBeenCalled();
        expect(globalFetch).toHaveBeenCalledWith(
            expect.stringContaining(
                `projects/${projectId}/databases/(default)/documents/users/user1`,
            ),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: `Bearer ${token}`,
                }),
            }),
        );
    });

    it("should call token function on every request (no caching)", async () => {
        const token1 = "token-1";
        const token2 = "token-2";
        const tokenFn = vi
            .fn()
            .mockResolvedValueOnce(token1)
            .mockResolvedValueOnce(token2);

        const projectId = "test-project";
        const client = new Firestore({
            projectId,
            token: tokenFn,
        });

        // Mock successful responses
        globalFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({}),
        });

        // First call
        await client._getDocument("doc1");
        expect(globalFetch).toHaveBeenLastCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: `Bearer ${token1}`,
                }),
            }),
        );
        expect(tokenFn).toHaveBeenCalledTimes(1);

        // Second call - should get new token immediately without waiting for expiry
        await client._getDocument("doc2");
        expect(globalFetch).toHaveBeenLastCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: `Bearer ${token2}`,
                }),
            }),
        );
        expect(tokenFn).toHaveBeenCalledTimes(2);
    });
});
