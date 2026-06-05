# Recipe Ingestor

The recipe ingestor application has two MVP parts:

* A local llama.cpp instance that can run models
* A Spring web application that takes in a recipe URL, fetches the page, sends it with context/instructions to the local LLM, and displays the result
