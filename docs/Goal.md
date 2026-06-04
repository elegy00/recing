# Recing
The recing application is set up from three parts in the architecture, or rather 4:
* A local llama.cpp instance that can run models
* A spring web application that takes on an URL of a recipe, pulls it down, sends it with context/instructions to the local llm and displays the result


## Messaging
Local redpanda setup with persisted message bus, using kafka as protocol