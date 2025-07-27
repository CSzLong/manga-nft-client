const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Starting deployment of MangaNFT and MonthlyDataUploader contracts using Foundry...\n");

    // Configuration - Update these values as needed
    const config = {
        // Network configuration
        rpcUrl: process.env.RPC_URL || "https://rpc-amoy.polygon.technology", // Default to local Anvil
        privateKey: process.env.PRIVATE_KEY || "a561d28ee8f35c86c88132952f0f82bc39ec24e240dd511c5229435f15927416", // Default Anvil private key

        // Contract addresses (will be filled after deployment)
        platformAddress: process.env.PLATFORM_ADDRESS || "0x12E2C1e3A8CA617689A4E4E6d6a098Faf08B8189",
        paymentToken: process.env.PAYMENT_TOKEN || "0x0000000000000000000000000000000000001010",
        uri: process.env.BASE_URI || "https://api.manga.com/metadata/",

        // Gas configuration
        gasLimit: 5000000,
        gasPrice: ethers.utils.parseUnits("20", "gwei")
    };

    // Connect to the network
    const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    const wallet = new ethers.Wallet(config.privateKey, provider);

    console.log("📝 Deploying contracts with account:", wallet.address);
    console.log("💰 Account balance:", ethers.utils.formatEther(await wallet.getBalance()), "ETH");
    console.log("🌐 Network:", (await provider.getNetwork()).name);
    console.log("🔗 RPC URL:", config.rpcUrl);

    console.log("\n⚙️  Deployment Configuration:");
    console.log("   Platform Address:", config.platformAddress);
    console.log("   Payment Token:", config.paymentToken);
    console.log("   Base URI:", config.uri);
    console.log("   Gas Limit:", config.gasLimit);
    console.log("   Gas Price:", ethers.utils.formatUnits(config.gasPrice, "gwei"), "gwei\n");

    try {
        // Load contract ABIs and bytecode from Foundry artifacts
        console.log("📦 Loading contract artifacts from Foundry...");

        const monthlyDataUploaderArtifact = JSON.parse(
            fs.readFileSync("./out/MonthlyDataUploader.sol/MonthlyDataUploader.json", "utf8")
        );

        const mangaNFTArtifact = JSON.parse(
            fs.readFileSync("./out/MangaNFT.sol/MangaNFT.json", "utf8")
        );

        console.log("✅ Contract artifacts loaded successfully\n");

        // Step 1: Deploy MonthlyDataUploader
        console.log("📦 Step 1: Deploying MonthlyDataUploader...");

        const monthlyDataUploaderFactory = new ethers.ContractFactory(
            monthlyDataUploaderArtifact.abi,
            monthlyDataUploaderArtifact.bytecode.object,
            wallet
        );

        const monthlyDataUploader = await monthlyDataUploaderFactory.deploy(
            config.platformAddress,
            ethers.constants.AddressZero, // Temporary MangaNFT address
            {
                gasLimit: config.gasLimit,
                gasPrice: config.gasPrice
            }
        );

        await monthlyDataUploader.deployed();
        console.log("✅ MonthlyDataUploader deployed to:", monthlyDataUploader.address);

        // Step 2: Deploy MangaNFT
        console.log("\n📦 Step 2: Deploying MangaNFT...");

        const mangaNFTFactory = new ethers.ContractFactory(
            mangaNFTArtifact.abi,
            mangaNFTArtifact.bytecode.object,
            wallet
        );

        const mangaNFT = await mangaNFTFactory.deploy(
            config.uri,
            config.platformAddress,
            config.paymentToken,
            monthlyDataUploader.address,
            {
                gasLimit: config.gasLimit,
                gasPrice: config.gasPrice
            }
        );

        await mangaNFT.deployed();
        console.log("✅ MangaNFT deployed to:", mangaNFT.address);

        // Step 3: Update MonthlyDataUploader with correct MangaNFT address
        console.log("\n📦 Step 3: Updating MonthlyDataUploader with MangaNFT address...");

        const updateTx = await monthlyDataUploader.updateMangaNFTContract(
            mangaNFT.address,
            {
                gasLimit: 200000,
                gasPrice: config.gasPrice
            }
        );

        await updateTx.wait();
        console.log("✅ MonthlyDataUploader updated with MangaNFT address");

        // Step 4: Verify the connection
        console.log("\n🔍 Step 4: Verifying contract connections...");

        const mangaNFTAddress = await monthlyDataUploader.mangaNFTContract();
        const monthlyDataUploaderAddress = await mangaNFT.monthlyDataUploader();

        console.log("   MonthlyDataUploader.mangaNFTContract():", mangaNFTAddress);
        console.log("   MangaNFT.monthlyDataUploader():", monthlyDataUploaderAddress);

        if (mangaNFTAddress === mangaNFT.address && monthlyDataUploaderAddress === monthlyDataUploader.address) {
            console.log("✅ Contract connections verified successfully!");
        } else {
            console.log("❌ Contract connections verification failed!");
        }

        // Step 5: Save deployment information
        console.log("\n💾 Step 5: Saving deployment information...");

        const deploymentInfo = {
            network: (await provider.getNetwork()).name,
            chainId: (await provider.getNetwork()).chainId,
            deployer: wallet.address,
            deploymentTime: new Date().toISOString(),
            contracts: {
                monthlyDataUploader: {
                    address: monthlyDataUploader.address,
                    constructorArgs: [config.platformAddress, ethers.constants.AddressZero],
                    abi: monthlyDataUploaderArtifact.abi
                },
                mangaNFT: {
                    address: mangaNFT.address,
                    constructorArgs: [config.uri, config.platformAddress, config.paymentToken, monthlyDataUploader.address],
                    abi: mangaNFTArtifact.abi
                }
            },
            config: config
        };

        // Create deployment directory if it doesn't exist
        const deploymentDir = path.join(__dirname, "../deployments");
        if (!fs.existsSync(deploymentDir)) {
            fs.mkdirSync(deploymentDir, { recursive: true });
        }

        // Save deployment info to file
        const deploymentFile = path.join(deploymentDir, `deployment-${Date.now()}.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        console.log("✅ Deployment information saved to:", deploymentFile);

        // Also save latest deployment
        const latestDeploymentFile = path.join(deploymentDir, "latest-deployment.json");
        fs.writeFileSync(latestDeploymentFile, JSON.stringify(deploymentInfo, null, 2));
        console.log("✅ Latest deployment information saved to:", latestDeploymentFile);

        // Step 6: Generate Foundry deployment script
        console.log("\n📝 Step 6: Generating Foundry deployment script...");

        const foundryScript = generateFoundryScript(deploymentInfo);
        const foundryScriptFile = path.join(deploymentDir, "DeployMangaNFT.s.sol");
        fs.writeFileSync(foundryScriptFile, foundryScript);
        console.log("✅ Foundry deployment script saved to:", foundryScriptFile);

        // Step 7: Display final summary
        console.log("\n🎉 Deployment Summary:");
        console.log("   ===================");
        console.log("   MonthlyDataUploader:", monthlyDataUploader.address);
        console.log("   MangaNFT:", mangaNFT.address);
        console.log("   Network:", deploymentInfo.network);
        console.log("   Chain ID:", deploymentInfo.chainId);
        console.log("   Deployer:", wallet.address);
        console.log("   Deployment Time:", deploymentInfo.deploymentTime);
        console.log("\n📋 Next Steps:");
        console.log("   1. Verify contracts on block explorer");
        console.log("   2. Set up frontend integration");
        console.log("   3. Test contract functionality");
        console.log("   4. Configure platform settings");
        console.log("\n🔧 Foundry Commands:");
        console.log("   forge script script/DeployMangaNFT.s.sol --rpc-url <RPC_URL> --broadcast");
        console.log("   forge verify-contract <CONTRACT_ADDRESS> src/MangaNFT.sol:MangaNFT --chain-id <CHAIN_ID>");

    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    }
}

// Generate Foundry deployment script
function generateFoundryScript(deploymentInfo) {
    return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MonthlyDataUploader.sol";
import "../src/MangaNFT.sol";

contract DeployMangaNFT is Script {
    function run() public {
        // Configuration
        address platformAddress = ${deploymentInfo.config.platformAddress};
        address paymentToken = ${deploymentInfo.config.paymentToken};
        string memory uri = "${deploymentInfo.config.uri}";

        // Start broadcasting
        vm.startBroadcast();

        // Deploy MonthlyDataUploader
        MonthlyDataUploader monthlyDataUploader = new MonthlyDataUploader(
            platformAddress,
            address(0) // Temporary MangaNFT address
        );
        console.log("MonthlyDataUploader deployed at:", address(monthlyDataUploader));

        // Deploy MangaNFT
        MangaNFT mangaNFT = new MangaNFT(
            uri,
            platformAddress,
            paymentToken,
            address(monthlyDataUploader)
        );
        console.log("MangaNFT deployed at:", address(mangaNFT));

        // Update MonthlyDataUploader with correct MangaNFT address
        monthlyDataUploader.updateMangaNFTContract(address(mangaNFT));
        console.log("Updated MangaNFT contract address in MonthlyDataUploader");

        vm.stopBroadcast();

        // Verify deployment
        require(monthlyDataUploader.mangaNFTContract() == address(mangaNFT), "MangaNFT address not set correctly");
        require(mangaNFT.monthlyDataUploader() == address(monthlyDataUploader), "MonthlyDataUploader address not set correctly");
        
        console.log("Deployment verification successful!");
    }
}`;
}

// Execute deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment script failed:", error);
        process.exit(1);
    });