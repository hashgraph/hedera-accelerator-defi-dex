import { getAllFilesSync } from "get-all-files";

export class Helper {
  static extractFileName(path: string): string {
    const output = path.split("/").at(-1)?.split(".");
    if (output && output?.length > 1) {
      return output[0];
    }
    return "";
  }

  static getContractPathList(path:string) {
    const info: {
      compiledPaths: Array<string>;
    } = {
      compiledPaths: [],
    };

    // reading compiled path to get json files
    try {
      info.compiledPaths = getAllFilesSync(path)
        .toArray()
        .filter((path) => {
          return (
            path.includes(".sol") &&
            !path.includes(".dbg") &&
            path.endsWith(".json")
          );
        });
    } catch (e) {
      info.compiledPaths = [];
    }
    return info;
  }
}