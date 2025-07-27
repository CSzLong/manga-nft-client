import dotenv from "dotenv";
dotenv.config();
import { ethers } from "ethers";
import {fileURLToPath} from "url";
import path from "path";
import fs from "fs";

async function main() {
    const RPC_URL = process.env.RPC_URL;
    const PRIVATE_KEY = process.env.CREATOR_KEY;
    const MANGA_NFT_ADDRESS = process.env.MANGA_NFT_ADDRESS;

    if (!RPC_URL || !PRIVATE_KEY || !MANGA_NFT_ADDRESS) {
        console.error("请确认 .env 文件中已正确设置 RPC_URL、CREATOR_KEY 和 MANGA_NFT_ADDRESS");
        process.exit(1);
    }

    // 读取 ABI
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const abiPath = path.resolve(__dirname, '../../abi/MangaNFT.json');
    console.log('ABI路径:', abiPath);

    if (!fs.existsSync(abiPath)) {
        console.error('ABI文件不存在，请先运行 forge build');
        process.exit(1);
    }

    const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8')).abi;

    // 连接 provider 和 signer
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(MANGA_NFT_ADDRESS, abi, wallet);

    console.log("准备调用 createChapter 方法...");
    console.log("调用者地址:", wallet.address);
    console.log("合约地址:", MANGA_NFT_ADDRESS);

    // 检查合约状态
    try {
        const platformAddress = await contract.platformAddress();
        console.log("平台地址:", platformAddress);

        const monthlyDataUploader = await contract.monthlyDataUploader();
        console.log("MonthlyDataUploader地址:", monthlyDataUploader);

        // 检查调用者是否是平台地址
        if (wallet.address.toLowerCase() !== platformAddress.toLowerCase()) {
            console.warn("⚠️  警告: 调用者地址与平台地址不匹配");
            console.warn("   调用者:", wallet.address);
            console.warn("   平台地址:", platformAddress);
        }
    } catch (error) {
        console.error("获取合约状态失败:", error.message);
    }

    // 调用 createChapter，注意 maxCopies 必须是10的倍数，这里用100
    try {
        console.log("\n开始调用 createChapter...");

        const tx = await contract.createChapter(
            "海贼王 第一话 冒险的黎明",               // mangaTitleZh
            "One Piece Chapter 1: Dawn of the Adventure",               // mangaTitleEn
            "ワンピース 第1話 冒険の夜明け",                // mangaTitleJp
            "伟大的冒险开始了！路飞踏上旅程的第一步。",              // descriptionZh
            "The grand adventure begins! Luffy sets off on his journey.",  // descriptionEn
            "壮大な冒険が始まる！ルフィの旅の第一歩。",              // descriptionJp
            100,                     // maxCopies，必须是10的倍数
            "https://gateway.pinata.cloud/ipfs/bafkreihepqt2p3szkcjfwiipmtgsgmyoz6vtpxiulcc3agv4zw6ezkfhvq", // uri_
            "0x1E86A3da7301AC98DD170278E2c5cF9D6d9616C7"  // creator_addr
        );

        console.log("✅ 交易已发送，交易哈希:", tx.hash);
        console.log("等待交易确认...");

        const receipt = await tx.wait();
        console.log("✅ 交易已确认，区块号:", receipt.blockNumber);

        // 解析事件
        const iface = new ethers.Interface(abi);
        for (const log of receipt.logs) {
            try {
                const parsedLog = iface.parseLog(log);

                if (parsedLog.name === "ChapterCreated") {
                    const { tokenId, creator, mangaTitleZh, mangaTitleEn, mangaTitleJp } = parsedLog.args;
                    console.log("\n🎉 ChapterCreated 事件:");
                    console.log("  🔸 tokenId:     ", tokenId.toString());
                    console.log("  🔸 creator:     ", creator);
                    console.log("  🔸 mangaTitleZh:", mangaTitleZh);
                    console.log("  🔸 mangaTitleEn:", mangaTitleEn);
                    console.log("  🔸 mangaTitleJp:", mangaTitleJp);
                }

                if (parsedLog.name === "ChapterMinted") {
                    const { tokenId, to, amountMinted, mintTime } = parsedLog.args;
                    console.log("\n🔔 ChapterMinted 事件:");
                    console.log("  🔸 tokenId:     ", tokenId.toString());
                    console.log("  🔸 to:          ", to);
                    console.log("  🔸 amountMinted:", amountMinted.toString());
                    console.log("  🔸 mintTime:    ", new Date(mintTime.toNumber() * 1000).toLocaleString());
                }
            } catch (parseError) {
                // 忽略无效事件
                console.log("跳过无效事件日志");
            }
        }

    } catch(err) {
        console.error("❌ 执行出错:", err.message);

        // 提供更详细的错误信息
        if (err.message.includes("require(false)")) {
            console.error("\n🔍 可能的原因:");
            console.error("1. 调用者不是平台地址");
            console.error("2. maxCopies 不是10的倍数");
            console.error("3. MonthlyDataUploader 合约配置问题");
            console.error("4. 合约权限问题");
        }

        if (err.message.includes("insufficient funds")) {
            console.error("余额不足，请检查账户余额");
        }

        if (err.message.includes("nonce")) {
            console.error("Nonce 错误，请等待之前的交易确认或手动设置 nonce");
        }

        process.exit(1);
    }
}

main().catch((error) => {
    console.error("❌ 执行出错:", error);
    process.exit(1);
});