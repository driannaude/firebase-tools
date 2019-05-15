import * as pathLib from "path";
import { expect } from "chai";

import { ListRemote } from "../../database/listRemote";

export class FakeListRemote implements ListRemote {
  data: any;
  delay: number;

  /**
   * @constructor
   * @param data           the fake database structure. Each leaf is an integer representing the subtree's size.
   * @param largeThreshold the threshold to determine if a delete exceeds the writeSizeLimit.
   *                       If the sum of all leaves to delete is larger than largeThreshold,
   *                       the delete will return false.
   */
  constructor(data: any) {
    this.data = data;
    this.delay = 0;
  }

  async listPath(
    path: string,
    numChildren: number,
    startAfter?: string,
    timeout?: number
  ): Promise<string[]> {
    const startTime = Date.now();
    await new Promise((resolve, _) => setTimeout(resolve, this.delay));
    const latency = Date.now() - startTime;
    if (timeout && latency >= timeout) {
      return Promise.reject(new Error("timeout"));
    }
    const d = this._dataAtpath(path);
    if (d) {
      let keys = Object.keys(d);
      /*
       * We mirror a critical implementation detail of here. Namely, the
       * `startAfter` option (if it exists) is applied to the resulting key set
       * before the `limitToFirst` option.
       */
      if (startAfter) {
        keys = keys.filter((key) => key > startAfter);
      }
      keys = keys.slice(0, numChildren);
      return Promise.resolve(keys);
    }
    return Promise.resolve([]);
  }

  private _size(data: any): number {
    if (typeof data === "number") {
      return data;
    }
    let size = 0;
    for (const key of Object.keys(data)) {
      size += this._size(data[key]);
    }
    return size;
  }

  private setArtificialDelay(delay: number): any {
    this.delay = delay;
  }

  private _dataAtpath(path: string): any {
    const splitedPath = path.slice(1).split("/");
    let d = this.data;
    for (const p of splitedPath) {
      if (d && p !== "") {
        if (typeof d === "number") {
          d = null;
        } else {
          d = d[p];
        }
      }
    }
    return d;
  }
}

describe("FakeListRemote", () => {
  it("should return limit the number of subpaths returned", async () => {
    const fakeDb = new FakeListRemote({ 1: 1, 2: 2, 3: 3, 4: 4 });
    await expect(fakeDb.listPath("/", 4)).to.eventually.eql(["1", "2", "3", "4"]);
    await expect(fakeDb.listPath("/", 3)).to.eventually.eql(["1", "2", "3"]);
    await expect(fakeDb.listPath("/", 2)).to.eventually.eql(["1", "2"]);
    await expect(fakeDb.listPath("/", 1)).to.eventually.eql(["1"]);
    await expect(fakeDb.listPath("/", 4, "1")).to.eventually.eql(["2", "3", "4"]);
    await expect(fakeDb.listPath("/", 4, "2")).to.eventually.eql(["3", "4"]);
    await expect(fakeDb.listPath("/", 4, "3")).to.eventually.eql(["4"]);
    await expect(fakeDb.listPath("/", 4, "4")).to.eventually.eql([]);
    await expect(fakeDb.listPath("/", 3, "1")).to.eventually.eql(["2", "3", "4"]);
    await expect(fakeDb.listPath("/", 3, "2")).to.eventually.eql(["3", "4"]);
    await expect(fakeDb.listPath("/", 3, "3")).to.eventually.eql(["4"]);
    await expect(fakeDb.listPath("/", 3, "3")).to.eventually.eql(["4"]);
    await expect(fakeDb.listPath("/", 3, "4")).to.eventually.eql([]);
    await expect(fakeDb.listPath("/", 1, "1")).to.eventually.eql(["2"]);
    await expect(fakeDb.listPath("/", 1, "2")).to.eventually.eql(["3"]);
    await expect(fakeDb.listPath("/", 1, "3")).to.eventually.eql(["4"]);
    await expect(fakeDb.listPath("/", 1, "4")).to.eventually.eql([]);
  });
});
