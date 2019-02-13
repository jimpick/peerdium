#! /bin/bash

CID=$(ipfs cid base32 `ipfs add -r -Q .`)
echo $CID
echo https://$CID.lunet.v6z.me/
