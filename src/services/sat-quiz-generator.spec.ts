import {describe, test} from "node:test";
import {expect} from "expect";
import {collapseArticleBeforeBlank} from "./sat-quiz-generator";

describe("collapseArticleBeforeBlank", () => {
    test("replaces an article directly before the blank", () => {
        expect(collapseArticleBeforeBlank("It was a [BLANK] response."))
            .toBe("It was a/an [BLANK] response.");
        expect(collapseArticleBeforeBlank("It was an [BLANK] response."))
            .toBe("It was a/an [BLANK] response.");
    });

    test("keeps the sentence-initial capital", () => {
        expect(collapseArticleBeforeBlank("An [BLANK] claim followed."))
            .toBe("A/an [BLANK] claim followed.");
    });

    test("also fixes an already rendered blank from the quiz cache", () => {
        expect(collapseArticleBeforeBlank("It was a <b>_____</b> response."))
            .toBe("It was a/an <b>_____</b> response.");
    });

    test("leaves articles that are not next to the blank alone", () => {
        expect(collapseArticleBeforeBlank("A scholar found the [BLANK] evidence."))
            .toBe("A scholar found the [BLANK] evidence.");
    });

    test("handles a line break between article and blank", () => {
        expect(collapseArticleBeforeBlank("an\n[BLANK]")).toBe("a/an\n[BLANK]");
    });
});
