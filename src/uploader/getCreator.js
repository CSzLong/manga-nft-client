import dotenv from "dotenv";
dotenv.config();
import { ethers } from "ethers";
import {fileURLToPath} from "url";
import path from "path";
import fs from "fs";

async function main() {
    const RPC_URL = process.env.RPC_URL;
    const PRIVATE_KEY = process.env.CREATOR_KEY;
    const MONTHLY_DATA_UPLOADER_ADDRESS = process.env.DATAUPLOADER_ADDRESS;

    if (!RPC_URL || !PRIVATE_KEY || !MONTHLY_DATA_UPLOADER_ADDRESS) {
        console.error("请确认 .env 文件中已正确设置 RPC_URL、CREATOR_KEY 和 MONTHLY_DATA_UPLOADER_ADDRESS");
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
    const contract = new ethers.Contract(MONTHLY_DATA_UPLOADER_ADDRESS, abi, wallet);

    console.log("准备调用 getCreatorStats 方法...");
    console.log("调用者地址:", wallet.address);
    console.log("合约地址:", MONTHLY_DATA_UPLOADER_ADDRESS);

    // 从命令行参数获取创作者地址
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error("❌ 请提供创作者地址");
        console.error("用法: node scripts/getCreatorStats.js <creator_address>");
        console.error("示例: node scripts/getCreatorStats.js 0x1234...");
        process.exit(1);
    }

    const creatorAddress = args[0];

    // 验证地址格式
    if (!ethers.isAddress(creatorAddress)) {
        console.error("❌ 无效的创作者地址:", creatorAddress);
        process.exit(1);
    }

    console.log("\n📋 查询信息:");
    console.log("  创作者地址:", creatorAddress);

    // 调用 getCreatorStats
    try {
        console.log("\n开始调用 getCreatorStats...");

        const stats = await contract.getCreatorStats(creatorAddress);

        console.log("✅ 查询成功！");
        console.log("\n📊 创作者统计信息:");
        console.log("  🔸 总发布数量 (totalPublished):", stats[0].toString());
        console.log("  🔸 总获得数量 (totalAcquired):", stats[1].toString());
        console.log("  🔸 当前持有数量 (currentHeld):", stats[2].toString());

        // 格式化显示
        console.log("\n📈 详细统计:");
        console.log("   =================");
        console.log("   总发布数量:", stats[0].toString(), "个章节");
        console.log("   总获得数量:", stats[1].toString(), "个NFT");
        console.log("   当前持有数量:", stats[2].toString(), "个NFT");

        if (stats[0].toString() !== "0") {
            const avgAcquired = Number(stats[1]) / Number(stats[0]);
            console.log("   平均每章节获得:", avgAcquired.toFixed(2), "个NFT");
        }

        // 检查是否为注册的创作者
        try {
            const isCreator = await contract.isCreator(creatorAddress);
            console.log("   注册状态:", isCreator ? "✅ 已注册" : "❌ 未注册");
        } catch (error) {
            console.log("   注册状态: 无法查询");
        }

        // 获取所有创作者列表（可选）
        try {
            const allCreators = await contract.getAllCreators();
            console.log("   总创作者数量:", allCreators.length, "个");

            if (allCreators.includes(creatorAddress)) {
                console.log("   在创作者列表中: ✅ 是");
            } else {
                console.log("   在创作者列表中: ❌ 否");
            }
        } catch (error) {
            console.log("   无法获取创作者列表");
        }

    } catch(err) {
        console.error("❌ 执行出错:", err.message);

        // 提供更详细的错误信息
        if (err.message.includes("Creator data not found")) {
            console.error("\n🔍 可能的原因:");
            console.error("1. 创作者地址不存在");
            console.error("2. 创作者从未发布过章节");
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