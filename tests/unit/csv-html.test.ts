import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvRecords } from "@/services/normalization/csv";
import { excerpt, htmlToText } from "@/services/normalization/html";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF and a BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
  });

  it("keeps empty fields and values like NA verbatim", () => {
    const { records } = parseCsvRecords("code,value\nNA,\n");
    expect(records).toEqual([{ code: "NA", value: "" }]);
  });

  it("rejects unterminated quotes", () => {
    expect(() => parseCsv('a\n"oops')).toThrow(SyntaxError);
  });
});

describe("htmlToText", () => {
  it("strips tags and scripts and decodes entities", () => {
    expect(htmlToText('<p>Cases&nbsp;rose&#160;&amp; fell</p><script>alert(1)</script><p>Second &lt;b&gt;</p>')).toBe(
      "Cases rose & fell\nSecond <b>",
    );
  });

  it("cuts long text at a sentence boundary", () => {
    const text = `${"A short sentence. ".repeat(10)}Tail`;
    const cut = excerpt(text, 100);
    expect(cut.length).toBeLessThanOrEqual(101);
    expect(cut.endsWith(".…")).toBe(true);
  });
});
