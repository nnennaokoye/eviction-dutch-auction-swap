import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ReverseDutchAuctionSwap, TestToken } from "../typechain-types";

describe("ReverseDutchAuctionSwap", function () {
  const TOKEN_NAME = "Test Token";
  const TOKEN_SYMBOL = "TEST";
  const INITIAL_SUPPLY = ethers.parseEther("1000000");

  
  const TOKEN_AMOUNT = ethers.parseEther("100");
  const START_PRICE = ethers.parseEther("1");  
  const END_PRICE = ethers.parseEther("0.1");  
  const DURATION = 3600; 

  async function deployContractsFixture() {
    const [owner, seller, buyer] = await ethers.getSigners();

    const TestToken = await ethers.getContractFactory("TestToken");
    const testToken = await TestToken.deploy(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY) as TestToken;

    const ReverseDutchAuctionSwap = await ethers.getContractFactory("ReverseDutchAuctionSwap");
    const auction = await ReverseDutchAuctionSwap.deploy() as ReverseDutchAuctionSwap;

    await testToken.transfer(seller.address, TOKEN_AMOUNT);
    await testToken.connect(seller).approve(auction.target, TOKEN_AMOUNT);

    return { testToken, auction, owner, seller, buyer };
  }

  describe("Auction Creation", function () {
    it("Should create an auction with correct parameters", async function () {
      const { auction, testToken, seller } = await loadFixture(deployContractsFixture);

      await expect(auction.connect(seller).createAuction(
        testToken.target,
        TOKEN_AMOUNT,
        START_PRICE,
        END_PRICE,
        DURATION
      )).to.emit(auction, "AuctionCreated");

      const auctionData = await auction.auctions(0);
      expect(auctionData.seller).to.equal(seller.address);
      expect(auctionData.tokenAmount).to.equal(TOKEN_AMOUNT);
      expect(auctionData.startPrice).to.equal(START_PRICE);
      expect(auctionData.endPrice).to.equal(END_PRICE);
    });

    it("Should fail if token amount is 0", async function () {
      const { auction, testToken, seller } = await loadFixture(deployContractsFixture);

      await expect(auction.connect(seller).createAuction(
        testToken.target,
        0,
        START_PRICE,
        END_PRICE,
        DURATION
      )).to.be.revertedWith("Token amount must be greater than 0");
    });
  });

  describe("Price Mechanism", function () {
    it("Should decrease price correctly over time", async function () {
      const { auction, testToken, seller } = await loadFixture(deployContractsFixture);

      await auction.connect(seller).createAuction(
        testToken.target,
        TOKEN_AMOUNT,
        START_PRICE,
        END_PRICE,
        DURATION
      );

      const initialPrice = await auction.getCurrentPrice(0);
      expect(initialPrice).to.be.closeTo(START_PRICE, ethers.parseEther("0.01"));

      await time.increase(DURATION / 2);

      const midPrice = await auction.getCurrentPrice(0);
      const expectedMidPrice = START_PRICE - ((START_PRICE - END_PRICE) / BigInt(2));
      expect(midPrice).to.be.closeTo(expectedMidPrice, ethers.parseEther("0.01"));
    });
  });

  describe("Swap Execution", function () {
    it("Should execute swap successfully", async function () {
      const { auction, testToken, seller, buyer } = await loadFixture(deployContractsFixture);

      await auction.connect(seller).createAuction(
        testToken.target,
        TOKEN_AMOUNT,
        START_PRICE,
        END_PRICE,
        DURATION
      );

      await time.increase(1800); 

      const currentPrice = await auction.getCurrentPrice(0);
      
      const initialBuyerBalance = await testToken.balanceOf(buyer.address);
      const initialSellerEthBalance = await ethers.provider.getBalance(seller.address);

      await expect(auction.connect(buyer).executeSwap(0, { value: currentPrice }))
        .to.emit(auction, "AuctionFinalized");

      expect(await testToken.balanceOf(buyer.address))
        .to.equal(initialBuyerBalance + TOKEN_AMOUNT);

      expect(await ethers.provider.getBalance(seller.address))
        .to.be.above(initialSellerEthBalance);
    });

    it("Should prevent multiple purchases for same auction", async function () {
      const { auction, testToken, seller, buyer, owner } = await loadFixture(deployContractsFixture);

      await auction.connect(seller).createAuction(
        testToken.target,
        TOKEN_AMOUNT,
        START_PRICE,
        END_PRICE,
        DURATION
      );

      const currentPrice = await auction.getCurrentPrice(0);
      
      await auction.connect(buyer).executeSwap(0, { value: currentPrice });

      await expect(auction.connect(owner).executeSwap(0, { value: currentPrice }))
        .to.be.revertedWith("Auction is not active");
    });
  });

  describe("Edge Cases", function () {
    it("Should not allow purchase after auction ends", async function () {
      const { auction, testToken, seller, buyer } = await loadFixture(deployContractsFixture);

      await auction.connect(seller).createAuction(
        testToken.target,
        TOKEN_AMOUNT,
        START_PRICE,
        END_PRICE,
        DURATION
      );

      await time.increase(DURATION + 1);

      await expect(auction.connect(buyer).executeSwap(0, { value: END_PRICE }))
        .to.be.revertedWith("Auction has ended");
    });

    it("Should allow seller to cancel auction", async function () {
      const { auction, testToken, seller } = await loadFixture(deployContractsFixture);

      await auction.connect(seller).createAuction(
        testToken.target,
        TOKEN_AMOUNT,
        START_PRICE,
        END_PRICE,
        DURATION
      );

      const initialSellerBalance = await testToken.balanceOf(seller.address);
      
      await auction.connect(seller).cancelAuction(0);

      expect(await testToken.balanceOf(seller.address))
        .to.equal(initialSellerBalance + TOKEN_AMOUNT);

      const auctionData = await auction.auctions(0);
      expect(auctionData.active).to.be.false;
      expect(auctionData.finalized).to.be.true;
    });
  });
});