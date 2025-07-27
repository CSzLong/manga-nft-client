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

    console.log("准备调用 investorRegistration 方法...");
    console.log("调用者地址:", wallet.address);
    console.log("合约地址:", MANGA_NFT_ADDRESS);

    // 检查合约状态
    try {
        const platformAddress = await contract.platformAddress();
        console.log("平台地址:", platformAddress);
        // 检查调用者是否是平台地址
        if (wallet.address.toLowerCase() !== platformAddress.toLowerCase()) {
            console.warn("⚠️  警告: 调用者地址与平台地址不匹配");
            console.warn("   调用者:", wallet.address);
            console.warn("   平台地址:", platformAddress);
        }
    } catch (error) {
        console.error("获取合约状态失败:", error.message);
    }

    // 从命令行参数获取投资者地址和代币ID
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error("❌ 请提供投资者地址和代币ID");
        console.error("用法: node scripts/investorRegistration.js <investor_address> <token_id>");
        console.error("示例: node scripts/investorRegistration.js 0x1234... 1234567890");
        process.exit(1);
    }

    const investorAddress = args[0];
    const tokenId = args[1];

    // 验证地址格式
    if (!ethers.isAddress(investorAddress)) {
        console.error("❌ 无效的投资者地址:", investorAddress);
        process.exit(1);
    }

    // 验证代币ID
    if (isNaN(tokenId) || tokenId <= 0) {
        console.error("❌ 无效的代币ID:", tokenId);
        process.exit(1);
    }

    console.log("\n📋 注册信息:");
    console.log("  投资者地址:", investorAddress);
    console.log("  代币ID:", tokenId);

    // 检查投资者是否持有该代币
    try {
        const balance = await contract.balanceOf(investorAddress, tokenId);
        console.log("  当前余额:", balance.toString());

        if (balance.toString() === "0") {
            console.error("❌ 投资者不持有该代币，无法注册");
            process.exit(1);
        }
    } catch (error) {
        console.error("❌ 检查余额失败:", error.message);
        process.exit(1);
    }

    // 调用 investorRegistration
    try {
        console.log("\n开始调用 investorRegistration...");

        const tx = await contract.investorRegistration(
            investorAddress,
            tokenId
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

                if (parsedLog.name === "InvestorNFTAcquired") {
                    const { investor, acquiredCount, totalAcquired } = parsedLog.args;
                    console.log("\n🎉 InvestorNFTAcquired 事件:");
                    console.log("  🔸 investor:     ", investor);
                    console.log("  🔸 acquiredCount:", acquiredCount.toString());
                    console.log("  🔸 totalAcquired:", totalAcquired.toString());
                }
            } catch (parseError) {
                // 忽略无效事件
                console.log("跳过无效事件日志");
            }
        }

        console.log("\n🎉 投资者注册成功！");

    } catch(err) {
        console.error("❌ 执行出错:", err.message);

        // 提供更详细的错误信息
        if (err.message.includes("require(false)")) {
            console.error("\n🔍 可能的原因:");
            console.error("1. 调用者不是平台地址");
            console.error("2. 投资者不持有该代币");
            console.error("3. 投资者已经注册过该代币");
            console.error("4. MonthlyDataUploader 合约配置问题");
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