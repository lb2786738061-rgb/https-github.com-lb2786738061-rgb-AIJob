import html2pdf from "html2pdf.js";

/** 96DPI 下标准 A4 像素尺寸，与 types.ts 保持一致 */
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

/**
 * 分页粒度上限：超过该高度的块允许跨页切割（因为放到任何一整页都放不下）。
 * 其余块若跨页边界，会被整体推到下一页，避免文字被从中间切断。
 */
const MAX_ATOMIC_BLOCK = A4_HEIGHT_PX - 120;

/** 导出时压缩底部内边距，避免内容刚好溢出页底几个像素而产生近乎空白的尾页 */
const EXPORT_PADDING_BOTTOM = "28px";

/** 判定一个块是否是区块标题（用于避免标题孤行在页尾） */
function looksLikeHeading(el: HTMLElement): boolean {
  if (el.tagName === "H2") return true;
  // 时间轴等模板的胶囊标题：矮小、只含行内元素
  if (el.querySelector("p, ul, li, .resume-entry")) return false;
  return el.getBoundingClientRect().height <= 36;
}

interface BlockRef {
  el: HTMLElement;
  top: number;
  bottom: number;
  section: HTMLElement | null;
}

/** 递归收集分页块：容器块过高时下钻到更细的子块，保证分页粒度尽量小 */
function pushBlock(blocks: BlockRef[], el: HTMLElement, section: HTMLElement | null, sheetTop: number): void {
  const rect = el.getBoundingClientRect();
  const height = rect.bottom - rect.top;

  if (height > MAX_ATOMIC_BLOCK && el.children.length > 0) {
    for (const child of Array.from(el.children) as HTMLElement[]) {
      pushBlock(blocks, child, section, sheetTop);
    }
    return;
  }

  blocks.push({
    el,
    section,
    top: rect.top - sheetTop,
    bottom: rect.bottom - sheetTop,
  });
}

function collectBlocks(sheet: HTMLElement): BlockRef[] {
  const sheetTop = sheet.getBoundingClientRect().top;
  const blocks: BlockRef[] = [];

  const header = sheet.querySelector<HTMLElement>("header");
  if (header) {
    const rect = header.getBoundingClientRect();
    blocks.push({ el: header, section: null, top: rect.top - sheetTop, bottom: rect.bottom - sheetTop });
  }

  for (const section of sheet.querySelectorAll<HTMLElement>("section")) {
    for (const child of Array.from(section.children) as HTMLElement[]) {
      pushBlock(blocks, child, section, sheetTop);
    }
  }

  return blocks;
}

/**
 * 在克隆出的简历页中插入分页撑高元素，
 * 让所有可分割边界落在空白处，避免导出 PDF 时文字被从中间切断。
 */
function paginateSheet(sheet: HTMLElement): void {
  sheet.style.paddingBottom = EXPORT_PADDING_BOTTOM;

  const blocks = collectBlocks(sheet);
  let shift = 0;

  const insertSpacerBefore = (target: HTMLElement, height: number): void => {
    if (height <= 0) return;
    const spacer = document.createElement("div");
    spacer.style.height = `${height}px`;
    spacer.setAttribute("data-export-pagebreak", "");
    target.parentNode?.insertBefore(spacer, target);
    shift += height;
  };

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    const top = block.top + shift;
    const bottom = block.bottom + shift;
    const pageEnd = (Math.floor(top / A4_HEIGHT_PX) + 1) * A4_HEIGHT_PX;

    if (bottom <= pageEnd) continue;
    // 过高的块放到整页也放不下，只能允许其跨页
    if (bottom - top > MAX_ATOMIC_BLOCK) continue;

    // 若该块紧跟区块标题且几乎贴着标题，把标题一起推到下一页，避免标题孤行
    // （模板中 h2/胶囊标题的下边距为 10~14px，阈值需覆盖该间距）
    let target = block.el;
    let targetTop = top;
    const prev = i > 0 ? blocks[i - 1] : null;
    if (
      prev &&
      prev.section === block.section &&
      looksLikeHeading(prev.el) &&
      top - (prev.bottom + shift) < 16
    ) {
      target = prev.el;
      targetTop = prev.top + shift;
    }

    insertSpacerBefore(target, pageEnd - targetTop);
  }
}

export async function exportResumePdf(element: HTMLElement, filename: string): Promise<void> {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.transform = "none";
  clone.style.transformOrigin = "top left";
  clone.style.boxShadow = "none";

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-9999px";
  wrapper.style.top = "0";
  wrapper.style.width = `${A4_WIDTH_PX}px`;
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    paginateSheet(clone);
    await html2pdf()
      .set({
        margin: 0,
        filename,
        // PNG 无损，避免 JPEG 压缩导致文字边缘发虚
        image: { type: "png" },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        // 分页完全由上面的撑高元素控制，禁用库自身的 avoid 逻辑避免二次分页错乱
        pagebreak: { mode: ["legacy"] },
      })
      .from(clone)
      .save();
  } finally {
    document.body.removeChild(wrapper);
  }
}
