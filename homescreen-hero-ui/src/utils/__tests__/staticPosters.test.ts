import { describe, it, expect } from "vitest";
import { getStaticPosters, shuffleArray, getShuffledStaticPosters } from "../staticPosters";

describe("getStaticPosters", () => {
    it("returns an array of poster URLs", () => {
        const posters = getStaticPosters();
        expect(posters.length).toBeGreaterThan(0);
        posters.forEach((url) => {
            expect(url).toMatch(/^\/posters\/setup_poster_\d+\.\w+$/);
        });
    });

    it("returns consistent results across calls", () => {
        expect(getStaticPosters()).toEqual(getStaticPosters());
    });
});

describe("shuffleArray", () => {
    it("returns an array with the same length", () => {
        const input = [1, 2, 3, 4, 5];
        expect(shuffleArray(input)).toHaveLength(5);
    });

    it("contains the same elements", () => {
        const input = [1, 2, 3, 4, 5];
        const result = shuffleArray(input);
        expect(result.sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it("does not mutate the original array", () => {
        const input = [1, 2, 3, 4, 5];
        const original = [...input];
        shuffleArray(input);
        expect(input).toEqual(original);
    });

    it("handles empty array", () => {
        expect(shuffleArray([])).toEqual([]);
    });

    it("handles single-element array", () => {
        expect(shuffleArray([42])).toEqual([42]);
    });

    it("produces different orderings (statistical)", () => {
        // Run multiple shuffles and check that at least one differs from input order
        const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const inputStr = input.join(",");
        let foundDifferent = false;

        for (let i = 0; i < 20; i++) {
            if (shuffleArray(input).join(",") !== inputStr) {
                foundDifferent = true;
                break;
            }
        }
        expect(foundDifferent).toBe(true);
    });
});

describe("getShuffledStaticPosters", () => {
    it("returns the same posters as getStaticPosters but possibly reordered", () => {
        const sorted = getStaticPosters().sort();
        const shuffled = getShuffledStaticPosters().sort();
        expect(shuffled).toEqual(sorted);
    });
});
