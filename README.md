# M2: Actors and Remote Procedure Calls (RPC)
> Full name: Ethan Williams
> Email:  ethan_williams@brown.edu
> Username:  ewilli51

## Summary
> Summarize your implementation, including key challenges you encountered

My implementation comprises 7 software components, totaling 287 lines of code. 

I had my most recent challenge when my serializer wouldn't serialize the `get()` thingy from the gradescope test. I fixed this by changing the format that was passed into eval.

Another issue I had was that `local` wasn't in the scope of eval. I fixed this by allowing the deserializer to pass in their own custom eval, which could be an arrow function in general, that captures the scope of the calling function.

A last issue I had was that we aren't allowed to use classes. I fixed this by just using objects with functions as fields.

## Correctness & Performance Characterization
> Describe how you characterized the correctness and performance of your implementation

*Correctness*: I wrote `<number>` tests; these tests take `<time>` to execute. 

*Performance*: I evaluated the performance over localhost using 1000 invocations of curl

    time for i in {1..1000}; do curl -s -X POST -d '{"idToObject":{"0":{"kind":"array","value":[{"kind":"leaf","value":"nid"}]}},"root":{"kind":"reference","value":0}}' localhost:8080/status/get > /dev/null; done

This took 5.922 seconds, which means that the average latency is 5.922 milliseconds. This is an insane latency over localhost. We can process 168.8 requests per second.

## Key Feature
> How would you explain your implementation of `createRPC` to your grandparents (assuming your grandparents are not computer scientists...), i.e., with the minimum jargon possible?

RPC is short for remote procedure call. For your atm to work, the atm needs to be able to communicate a transaction to your bank whenever one happens. The transaction is the remote procedure, which is "called" whenever you do a transaction. 

## Time to Complete
> Roughly, how many hours did this milestone take you to complete?

Hours: 7
