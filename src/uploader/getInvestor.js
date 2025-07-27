import dotenv from "dotenv";
dotenv.config();
import { ethers } from "ethers";
import {fileURLToPath} from "url";
import path from "path";
import fs from "fs";

async function main() {
    const RPC_URL = process.env.RPC_URL;
    const PRIVATE_KEY = process.env.CREATOR_KEY;
    const MANGA_NFT_ADDRESS = process.env.DATAUPLOADER_ADDRESS;

    if (!RPC_URL || !PRIVATE_KEY || !MANGA_NFT_ADDRESS) {
        console.error("请确认 .env 文件中已正确设置 RPC_URL、CREATOR_KEY 和 MANGA_NFT_ADDRESS");
        process.exit(1);
    }

    // 读取 ABI
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const abiPath = path.resolve(__dirname, '../../abi/MonthlyDataUploader.json');
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

    console.log("准备调用 getInvestorStats 方法...");
    console.log("调用者地址:", wallet.address);
    console.log("合约地址:", MANGA_NFT_ADDRESS);

    // 检查合约状态
    try {
        const platformAddress = await contract.platformAddress();
        console.log("平台地址:", platformAddress);

    } catch (error) {
        console.error("获取合约状态失败:", error.message);
    }

    // 从命令行参数获取投资者地址
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error("❌ 请提供投资者地址");
        console.error("用法: node scripts/getInvestorStats.js <investor_address>");
        console.error("示例: node scripts/getInvestorStats.js 0x1234...");
        process.exit(1);
    }

    const investorAddress = args[0];

    // 验证地址格式
    if (!ethers.isAddress(investorAddress)) {
        console.error("❌ 无效的投资者地址:", investorAddress);
        process.exit(1);
    }

    console.log("\n📋 查询信息:");
    console.log("  投资者地址:", investorAddress);

    // 调用 getInvestorStats
    try {
        console.log("\n开始调用 getInvestorStats...");


        const stats = await contract.getInvestorStats(investorAddress);

        console.log("✅ 查询成功！");
        console.log("\n📊 投资者统计信息:");
        console.log("  🔸 总获得数量 (totalAcquired):", stats[0].toString());
        console.log("  🔸 当前持有数量 (currentHeld):", stats[1].toString());

        // 格式化显示
        console.log("\n📈 详细统计:");
        console.log("   =================");
        console.log("   总获得数量:", stats[0].toString(), "个NFT");
        console.log("   当前持有数量:", stats[1].toString(), "个NFT");

        if (stats[0].toString() !== "0") {
            const retentionRate = (Number(stats[1]) / Number(stats[0]) * 100).toFixed(2);
            console.log("   持有率:", retentionRate + "%");
        }

        // 检查是否为注册的投资者
        try {
            const isInvestor = await monthlyDataUploaderContract.isInvestor(investorAddress);
            console.log("   注册状态:", isInvestor ? "✅ 已注册" : "❌ 未注册");
        } catch (error) {
            console.log("   注册状态: 无法查询");
        }

        // 获取所有投资者列表（可选）
        try {
            const allInvestors = await monthlyDataUploaderContract.getAllInvestors();
            console.log("   总投资者数量:", allInvestors.length, "个");

            if (allInvestors.includes(investorAddress)) {
                console.log("   在投资者列表中: ✅ 是");
            } else {
                console.log("   在投资者列表中: ❌ 否");
            }
        } catch (error) {
            console.log("   无法获取投资者列表");
        }

        // 获取投资者持有的代币列表（可选）
        try {
            const currentHeldCount = await monthlyDataUploaderContract.getCurrentHeldNFTCountByInvestorExternal(investorAddress);
            console.log("   当前持有NFT总数:", currentHeldCount.toString(), "个");
        } catch (error) {
            console.log("   无法获取当前持有数量");
        }

        // 获取当前年月的月度统计（可选）
        try {
            const currentYearMonth = Math.floor(Date.now() / 1000 / 60 / 60 / 24 / 30); // 简化的年月计算
            const monthlyStats = await monthlyDataUploaderContract.getInvestorMonthlyStats(investorAddress, currentYearMonth);
            console.log("   当月获得数量:", monthlyStats.toString(), "个NFT");
        } catch (error) {
            console.log("   无法获取月度统计");
        }

    } catch(err) {
        console.error("❌ 执行出错:", err.message);

        // 提供更详细的错误信息
        if (err.message.includes("Investor data not found")) {
            console.error("\n🔍 可能的原因:");
            console.error("1. 投资者地址不存在");
            console.error("2. 投资者从未获得过NFT");
            console.error("3. 合约数据为空");
        }

        if (err.message.includes("execution reverted")) {
            console.error("\n🔍 可能的原因:");
            console.error("1. 合约地址错误");
            console.error("2. ABI 不匹配");
            console.error("3. 网络连接问题");
        }

        process.exit(1);
    }
}

main().catch((error) => {
    console.error("❌ 执行出错:", error);
    process.exit(1);
});