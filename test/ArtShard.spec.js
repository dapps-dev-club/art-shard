const { accounts, contract } = require('@openzeppelin/test-environment');
const assert = require('assert');
const web3 = require('web3');

const BN = web3.utils.BN;

const ArtShard = contract.fromArtifact('ArtShard');

describe('ArtShard - initial state', () => {
  const [owner] = accounts;

  let instance;

  before(async () => {
    instance = await ArtShard.new({
      from: owner,
    });
  });

  it('ART_DENARIUS', async () => {
    const ART_DENARIUS = await instance.ART_DENARIUS.call();
    assert.equal(ART_DENARIUS.toString(), '0',
      'unexpected initial value for ART_DENARIUS');
  });

  it('NON_FUNGIBLE_INDEX', async () => {
    const NON_FUNGIBLE_INDEX = await instance.NON_FUNGIBLE_INDEX.call();
    assert.equal(NON_FUNGIBLE_INDEX.toString(), '256',
      'unexpected initial value for NON_FUNGIBLE_INDEX');
  });

  it('artIdx', async () => {
    const artIdx = await instance.artIdx.call();
    assert.equal(artIdx.toString(), '256',
      'unexpected initial value for artIdx');
  });

  it('balance of owner', async () => {
    const ART_DENARIUS = await instance.ART_DENARIUS.call();
    const balanceOfOwnerForArtDenarius = await instance.balanceOf.call(
      owner, // address from;
      ART_DENARIUS, // uint256 id;
    );
    assert.equal(balanceOfOwnerForArtDenarius.toString(),
      '1000000000000000000000000000000000000', // 10^36
      'unexpected initial value for ');
  });
});

const ART_DENARIUS_TEST_START_BALANCE = 50e6;

async function setupHelper(
  shouldTransferFtToOtherAccounts,
) {
  const [
    owner,
    artistA,
    artistB,
    underwriterA,
    underwriterB,
    buyerA,
    buyerB,
  ] = accounts;

  // initialise instance using first account as owner account
  const instance = await ArtShard.new({
    from: owner,
  });
  const ART_DENARIUS = await instance.ART_DENARIUS.call();
  const NON_FUNGIBLE_INDEX = await instance.NON_FUNGIBLE_INDEX.call();

  if (shouldTransferFtToOtherAccounts) {
    const transferFtPromises = [
      artistA,
      artistB,
      underwriterA,
      underwriterB,
      buyerA,
      buyerB,
    ].map((toAccount) => {
      return instance.safeTransferFrom(
        owner, // address _from,
        toAccount, // address _to,
        ART_DENARIUS, // uint256 _id,
        new BN(ART_DENARIUS_TEST_START_BALANCE), // uint256 _value,
        '0x', // bytes calldata _data,
        { from: owner },
      );
    });
    await Promise.all(transferFtPromises);
  }

  return {
    instance,
    ART_DENARIUS,
    NON_FUNGIBLE_INDEX,
    owner,
    artistA,
    artistB,
    underwriterA,
    underwriterB,
    buyerA,
    buyerB,
  };
}

describe('ArtShard - produceArt', () => {
  let owner;
  let instance;
  let ART_DENARIUS;
  let NON_FUNGIBLE_INDEX;

  let createdArtIdx;

  before(async () => {
    ({
      owner,
      instance,
      ART_DENARIUS,
      NON_FUNGIBLE_INDEX,
    } = await setupHelper(false));
  });

  it('invoke without state transition', async () => {
    let artIdx;
    artIdx = await instance.artIdx.call();
    assert.equal(artIdx.toString(), NON_FUNGIBLE_INDEX.toString(),
      'unexpected pre-transition call artIdx value');

    const artId = await instance.produceArt.call(
      '0x0123456789abcdef0123456789abcdef', // bytes32 uri,
      new BN('10000000'), // uint256 unitPrice,
      ART_DENARIUS, // uint256 unitPriceTokenId,
      new BN('1000000'), // 10% // uint256 unitCommission,
      10, // uint16 unitsTotal,
      2, // uint16 unitsArtistStake
      { from: owner },
    );

    assert.equal(artId.toString(), NON_FUNGIBLE_INDEX.addn(1).toString(),
      'unexpected return value');

    artIdx = await instance.artIdx.call();
    assert.equal(artIdx.toString(), NON_FUNGIBLE_INDEX.toString(),
      'unexpected post-transition call artIdx value');
  });

  it('invoke with state transition', async () => {
    let artIdx;
    artIdx = await instance.artIdx.call();
    assert.equal(artIdx.toString(), NON_FUNGIBLE_INDEX.toString(),
      'unexpected pre-transition call artIdx value');

    await instance.produceArt(
      '0x1123456789abcdef2123456789abcdef3123456789abcdef4123456789abcdef',
      // bytes32 uri,
      new BN('10000000'), // uint256 unitPrice,
      ART_DENARIUS, // uint256 unitPriceTokenId,
      new BN('1000000'), // 10% // uint256 unitCommission,
      10, // uint16 unitsTotal,
      2, // uint16 unitsArtistStake
      { from: owner },
    );

    artIdx = await instance.artIdx.call();
    assert.equal(artIdx.toString(), NON_FUNGIBLE_INDEX.addn(1).toString(),
      'unexpected post-transition call artIdx value');

    createdArtIdx = artIdx;
  });

  it('store new art object', async () => {
    const art = await instance.arts.call(createdArtIdx);

    assert.equal(
      art.uri,
      '0x1123456789abcdef2123456789abcdef3123456789abcdef4123456789abcdef',
      'unexpected value for art.uri',
    );

    assert.equal(
      art.unitPrice.toString(),
      '10000000',
      'unexpected value for art.unitPrice',
    );

    assert.equal(
      art.unitPriceTokenId.toString(),
      ART_DENARIUS,
      'unexpected value for art.unitPriceTokenId',
    );

    assert.equal(
      art.unitCommission.toString(),
      '1000000',
      'unexpected value for art.unitCommission',
    );

    assert.equal(
      art.unitsTotal.toString(),
      '10',
      'unexpected value for art.unitsTotal',
    );

    assert.equal(
      art.unitsUnderwritten.toString(),
      '2',
      'unexpected value for art.unitsUnderwritten',
    );

    assert.equal(
      art.artist.toString(),
      owner,
      'unexpected value for art.artist',
    );

    assert.equal(
      art.underwriterCount.toString(),
      '1',
      'unexpected value for art.underwriterCount',
    );

    assert.equal(
      art.isAvailable,
      false,
      'unexpected value for art.isAvailable',
    );
  });

  it('stores artist as underwriter', async () => {
    const underwrite =
      await instance.getArtUnderwriter.call(createdArtIdx, 1);

    assert.equal(
      underwrite.account,
      owner,
      'unexpected value for underwrite.account',
    );

    assert.equal(
      underwrite.quantity.toString(),
      '2',
      'unexpected value for underwrite.quantity',
    );
  });

});

describe('ArtShard - underwriteArt', () => {
  let instance;
  let ART_DENARIUS;
  let NON_FUNGIBLE_INDEX;

  let owner;
  let underwriterA;
  let underwriterB;
  let buyerA;
  let buyerB;

  let createdArtIdx1;
  let createdArtIdx2;

  before(async () => {
    ({
      instance,
      ART_DENARIUS,
      NON_FUNGIBLE_INDEX,
      owner,
      underwriterA,
      underwriterB,
      buyerA,
      buyerB,
    } = await setupHelper(true));

    let artIdx;

    await instance.produceArt(
      '0x1123456789abcdef2123456789abcdef3123456789abcdef4123456789abcdef',
      // bytes32 uri,
      new BN('10000000'), // uint256 unitPrice,
      ART_DENARIUS, // uint256 unitPriceTokenId,
      new BN('1000000'), // 10% // uint256 unitCommission,
      10, // uint16 unitsTotal,
      2, // uint16 unitsArtistStake
      { from: owner },
    );

    artIdx = await instance.artIdx.call();
    createdArtIdx1 = artIdx;

    await instance.produceArt(
      '0x2123456789abcdef2123456789abcdef3123456789abcdef4123456789abcdef',
      // bytes32 uri,
      new BN('999000000'), // uint256 unitPrice,
      ART_DENARIUS, // uint256 unitPriceTokenId,
      new BN('9990000'), // 1% // uint256 unitCommission,
      20, // uint16 unitsTotal,
      1, // uint16 unitsArtistStake
      { from: owner },
    );

    artIdx = await instance.artIdx.call();
    assert.equal(artIdx.toString(), NON_FUNGIBLE_INDEX.addn(2).toString(),
      'sanity check failure');

    createdArtIdx2 = artIdx;
  });

  it('invoke without state transition', async () => {
    await instance.underwriteArt.call(
      createdArtIdx1, // uint256 artId,
      new BN(8), // uint16 unitsUnderwritten
      { from: underwriterA },
    );

    // doesn't do anything, just checking that it doesn't
    // revert
  });

  it('invoke with state transition', async () => {
    await instance.underwriteArt(
      createdArtIdx1, // uint256 artId,
      new BN(8), // uint16 unitsUnderwritten
      { from: underwriterA },
    );

    // note that assertions are in subsequent blocks
  });

  it('updates art object', async () => {
    const art = await instance.arts.call(createdArtIdx1);

    // const {
    //   uri,
    //   unitPrice,
    //   unitPriceTokenId,
    //   unitCommission,
    //   unitsTotal,
    //   unitsUnderwritten,
    //   artist,
    //   underwriterCount,
    //   isAvailable,
    // } = art;

    // const artForAssertion = {
    //   uri,
    //   unitPrice: unitPrice.toString(),
    //   unitPriceTokenId: unitPriceTokenId.toString(),
    //   unitCommission: unitCommission.toString(),
    //   unitsTotal: unitsTotal.toString(),
    //   unitsUnderwritten: unitsUnderwritten.toString(),
    //   artist,
    //   underwriterCount: underwriterCount.toString(),
    //   isAvailable,
    // };
    // console.log(artForAssertion);

    assert.equal(
      art.uri,
      '0x1123456789abcdef2123456789abcdef3123456789abcdef4123456789abcdef',
      'unexpected value for art.uri',
    );

    assert.equal(
      art.unitPrice.toString(),
      '10000000',
      'unexpected value for art.unitPrice',
    );

    assert.equal(
      art.unitPriceTokenId.toString(),
      ART_DENARIUS,
      'unexpected value for art.unitPriceTokenId',
    );

    assert.equal(
      art.unitCommission.toString(),
      '1000000',
      'unexpected value for art.unitCommission',
    );

    assert.equal(
      art.unitsTotal.toString(),
      '10',
      'unexpected value for art.unitsTotal',
    );

    assert.equal(
      art.unitsUnderwritten.toString(),
      '10',
      'unexpected value for art.unitsUnderwritten',
    );

    assert.equal(
      art.artist.toString(),
      owner,
      'unexpected value for art.artist',
    );

    assert.equal(
      art.underwriterCount.toString(),
      '2',
      'unexpected value for art.underwriterCount',
    );

    assert.equal(
      art.isAvailable,
      true,
      'unexpected value for art.isAvailable',
    );
  });

  it('stores underwriter as underwriter', async () => {
    const underwrite2 =
      await instance.getArtUnderwriter.call(createdArtIdx1, 2);

    assert.equal(
      underwrite2.account,
      underwriterA,
      'unexpected 2nd value for underwrite.account',
    );

    assert.equal(
      underwrite2.quantity.toString(),
      '8',
      'unexpected 2nd value for underwrite.quantity',
    );
  });

  // TODO with 2nd piece of art, do not fully underwrite it
});

describe('ArtShard - buyArt', () => {
  let instance;
  let ART_DENARIUS;
  let NON_FUNGIBLE_INDEX;

  let owner;
  let artistA;
  let artistB;
  let underwriterA;
  let underwriterB;
  let buyerA;
  let buyerB;

  let createdArtIdx1;

  before(async () => {
    ({
      owner,
      instance,
      artistA,
      artistB,
      underwriterA,
      underwriterB,
      buyerA,
      buyerB,
      ART_DENARIUS,
      NON_FUNGIBLE_INDEX,
    } = await setupHelper(true));

    let artIdx;

    await instance.produceArt(
      '0x1123456789abcdef2123456789abcdef3123456789abcdef4123456789abcdef',
      // bytes32 uri,
      new BN('10000000'), // uint256 unitPrice,
      ART_DENARIUS, // uint256 unitPriceTokenId,
      new BN('1000000'), // 10% // uint256 unitCommission,
      10, // uint16 unitsTotal,
      2, // uint16 unitsArtistStake
      { from: artistA },
    );

    artIdx = await instance.artIdx.call();
    createdArtIdx1 = artIdx;

    await instance.underwriteArt(
      createdArtIdx1, // uint256 artId,
      new BN(8), // uint16 unitsUnderwritten
      { from: underwriterA },
    );

    artIdx = await instance.artIdx.call();
    assert.equal(
      artIdx.toString(),
      NON_FUNGIBLE_INDEX.addn(1).toString(),
      'sanity check failure - artIdx');
    const art = await instance.arts.call(createdArtIdx1);
    assert.equal(
      art.isAvailable,
      true,
      'sanity check failure - isAvailable',
    );
    createdArtIdx1 = artIdx;
  });

  it('invoke without state transition', async () => {
    await instance.buyArt.call(
      createdArtIdx1, // uint256 artId,
      2, // uint16 units,
      artistA, // address seller
      { from: buyerA },
    );

    // doesn't do anything, just checking that it doesn't
    // revert
  });

  it('pre-transition sanity checks', async () => {
    const sellerNftCount = await instance.balanceOf(
      artistA,
      createdArtIdx1,
    );
    assert.equal(
      sellerNftCount.toString(),
      '10',
      'unexpected seller NFT balance',
    );

    const buyerNftCount = await instance.balanceOf(
      buyerA,
      createdArtIdx1,
    );
    assert.equal(
      buyerNftCount.toString(),
      '0',
      'unexpected buyer NFT balance',
    );

    const buyerFtCount = await instance.balanceOf(
      buyerA,
      ART_DENARIUS,
    );
    assert.equal(
      buyerFtCount.toString(),
      '50000000',
      'unexpected buyer FT balance',
    );

    const sellerFtCount = await instance.balanceOf(
      artistA,
      ART_DENARIUS,
    );
    assert.equal(
      sellerFtCount.toString(),
      '50000000',
      'unexpected seller FT balance',
    );
  });

  describe('first purchase', () => {

    it('invoke with state transition', async () => {
      await instance.buyArt(
        createdArtIdx1, // uint256 artId,
        2, // uint16 units,
        artistA, // address seller
        { from: buyerA },
      );

      // note that assertions are in subsequent blocks
    });

    it('seller should have NFT count decrease by units sold', async () => {
      const sellerNftCount = await instance.balanceOf(
        artistA,
        createdArtIdx1,
      );

      assert.equal(
        sellerNftCount.toString(),
        '8',
        'unexpected balance',
      );
    });

    it('underwriter should have FT count increase by commissions times units sold', async () => {
      const underwriterFtCount = await instance.balanceOf(
        underwriterA,
        ART_DENARIUS,
      );

      // startBalance plus
      // (unitCommission times unitsSold times
      // unitsUnderwritten divided unitsTotal)
      // 50m + (1m * 2 * 8 / 10) = 51.6m

      assert.equal(
        underwriterFtCount.toString(),
        '51600000',
        'unexpected balance',
      );
    });

    it('seller (also artist) should have FT count increase by price less commissions times units sold, and also earn commissions from stake', async () => {
      const sellerFtCount = await instance.balanceOf(
        artistA,
        ART_DENARIUS,
      );

      // startBalance plus
      // ((unitPrice minus unitCommission) times (unitsSold))
      // 50m + ((10m - 1m) * 2) = 68m

      // in this case the seller is the artist who also is an
      // underwriter because of staked units/
      // startBalance plus
      // (unitCommission times unitsSold times
      // unitsStaked divided unitsTotal)
      // 68m + (1m * 2 * 2 / 10) = 68.4m

      assert.equal(
        sellerFtCount.toString(),
        '68400000',
        'unexpected balance',
      );
    });

    it('buyer should have NFT count increase by units sold', async () => {
      const buyerNftCount = await instance.balanceOf(
        buyerA,
        createdArtIdx1,
      );

      assert.equal(
        buyerNftCount.toString(),
        '2',
        'unexpected balance',
      );
    });

    it('buyer should have FT count decrease by unit price times units sold', async () => {
      const buyerFtCount = await instance.balanceOf(
        buyerA,
        ART_DENARIUS,
      );

      // startBalance minus
      // (unitPrice times unitsSold)
      // 50m + (10m * 2) = 30m

      assert.equal(
        buyerFtCount.toString(),
        '30000000',
        'unexpected balance',
      );
    });

  });
});