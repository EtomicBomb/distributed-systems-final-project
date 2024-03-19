# M2: Actors and Remote Procedure Calls (RPC)
> Full name: Ethan Williams
> Email:  ethan_williams@brown.edu
> Username:  ewilli51

## Summary

> Summarize your implementation, including key challenges you encountered

I added mem.js, store.js, and memStore.js, which total about 100 lines of code. I added about 60 lines of code to id.js. I added about 60 lines to local.js for support.

The first key challenge was getting M3 to pass on the autograder. This was solved after a TA told me about the issue and got my code to work with the fact that gradescope strips the executable bit from files.

The next challenge was getting my hashing code to match with gradescope test. It was poorly specified in the handout, so I had to play around with the order of concatenation, hashing, and calling toString on the provided list.

Another challenge was dealing with the fact that there would be a lot of code duplication. I solved this by merging the global mem and store routines into memStore, and having mem.js and store.js be small wrappers that calls them.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation

I wrote tests that tested some of the parameters of the mem and local storage that were not covered by the handout. For example, the handout did not poke at keys that had weird characters that are hard to put in the file system. I included tests for this case and others.

*Correctness*: I wrote 5 tests; these tests take 0.834s to execute.

*Performance*: Storing and retrieving 1000 5-property objects using a 3-node setup results in following average throughput and latency characteristics: `<avg. throughput>`obj/sec and `<avg. latency>` (ms/object) (Note: these objects were pre-generated in memory to avoid accounting for any performance overheads of generating these objects between experiments).

I could only spawn 400 objects due to stack size limits. It took 0m0.218s. This is 1835 objects per second, or 0.545 ms per frame.

## Key Feature

> Why is the `reconf` method designed to first identify all the keys to be relocated and then relocate individual objects instead of fetching all the objects immediately and then pushing them to their corresponding locations?

We want to save work by not relocating objects that do not need to be moved. There is a high likelyhood that many objects may not need to be relocated. If we had to fetch the object values, we would be reading objects that did not need to move. These objects may be large, and so relocating them would have significant network and CPU cost.

## Time to Complete

> Roughly, how many hours did this milestone take you to complete?

I am not sure how long this took to complete. I worked on it a few hours here
and there since over the past two weeks. I had an unusual work schedule since I
was still trying to get the m3 tests to pass while I was working on m4.

Hours: 8
