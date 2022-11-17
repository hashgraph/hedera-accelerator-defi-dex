import { getAllFilesSync } from "get-all-files";

export class Helper {
  static getFileNameFromPath(path: string): string {
    return path.split("/").at(-1)?.split(".")[0] || "";
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