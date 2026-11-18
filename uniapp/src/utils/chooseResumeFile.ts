export interface PickedResume {
  path: string;
  name: string;
}

export function chooseResumeFile(): Promise<PickedResume> {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    uni.chooseMessageFile({
      count: 1,
      type: "file",
      extension: ["pdf", "doc", "docx", "txt"],
      success(res) {
        const file = res.tempFiles[0];
        resolve({ path: file.path, name: file.name || "resume" });
      },
      fail(err) {
        reject(new Error(err.errMsg || "请选择 PDF/Word/TXT 文件"));
      },
    });
    // #endif

    // #ifndef MP-WEIXIN
    uni.chooseFile({
      count: 1,
      extension: [".pdf", ".doc", ".docx", ".txt"],
      success(res) {
        const file = res.tempFiles[0] as { path: string; name?: string };
        resolve({ path: file.path, name: file.name || "resume" });
      },
      fail(err) {
        reject(new Error(err.errMsg || "请选择 PDF/Word/TXT 文件"));
      },
    });
    // #endif
  });
}
