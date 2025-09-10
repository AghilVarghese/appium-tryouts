from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.vectorstores import Chroma

class InMemoryChromaDB:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(InMemoryChromaDB, cls).__new__(cls)
            cls._instance._init_dbs()
        return cls._instance

    def _init_dbs(self):
        self.embeddings = OllamaEmbeddings(model="all-minilm:latest")
        self.in_memory_test_steps_db = Chroma(embedding_function=self.embeddings, collection_name="test_steps")
        self.in_memory_pom_db = Chroma(embedding_function=self.embeddings, collection_name="pom_files")

    def add_test_step(self, docs):
        if self.in_memory_test_steps_db is None:
            self._init_dbs()
        self.in_memory_test_steps_db.add_documents(docs)

    def add_pom_file(self, docs):
        if self.in_memory_pom_db is None:
            self._init_dbs()
        self.in_memory_pom_db.add_documents(docs)

    def query_test_steps(self, query, k=5, temperature=0.7):
        if self.in_memory_test_steps_db is None:
            return []
        # If temperature is supported by Chroma, pass it; else, ignore
        try:
            return self.in_memory_test_steps_db.similarity_search(query, k=k, temperature=temperature)
        except TypeError:
            return self.in_memory_test_steps_db.similarity_search(query, k=k)

    def query_pom_files(self, query, k=5, temperature=0.7):
        if self.in_memory_pom_db is None:
            return []
        try:
            return self.in_memory_pom_db.similarity_search(query, k=k, temperature=temperature)
        except TypeError:
            return self.in_memory_pom_db.similarity_search(query, k=k)

    def clear_dbs(self):
        self._init_dbs()
