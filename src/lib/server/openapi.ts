/**
 * OpenAPI 3.0 Specification for BookShelf V2 API
 */
export const openApiSpec = {
	openapi: '3.0.0',
	info: {
		title: 'BookShelf V2 API',
		version: '1.0.0',
		description: 'API for managing your book collection'
	},
	servers: [
		{
			url: '/api',
			description: 'Local development server'
		}
	],
	tags: [
		{ name: 'Auth', description: 'Authentication endpoints' },
		{ name: 'Books', description: 'Book management' },
		{ name: 'Authors', description: 'Author management' },
		{ name: 'Series', description: 'Series management' },
		{ name: 'Tags', description: 'Tag management' },
		{ name: 'Genres', description: 'Genre management' },
		{ name: 'Formats', description: 'Format management' },
		{ name: 'Narrators', description: 'Narrator management' },
		{ name: 'Statuses', description: 'Reading status management' },
		{ name: 'Ebooks', description: 'Ebook file management' },
		{ name: 'Covers', description: 'Cover image management' },
		{ name: 'Search', description: 'Search functionality' },
		{ name: 'Import', description: 'Data import' },
		{ name: 'Export', description: 'Data export' }
	],
	paths: {
		// Authentication
		'/auth/login': {
			post: {
				tags: ['Auth'],
				summary: 'Login',
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									email: { type: 'string', format: 'email' },
									password: { type: 'string' }
								},
								required: ['email', 'password']
							},
							example: {
								email: 'test@example.com',
								password: 'password123'
							}
						}
					}
				},
				responses: {
					'200': { description: 'Login successful' },
					'401': { description: 'Invalid credentials' }
				}
			}
		},
		'/auth/me': {
			get: {
				tags: ['Auth'],
				summary: 'Get current user',
				responses: {
					'200': { description: 'Current user info' },
					'401': { description: 'Not authenticated' }
				}
			}
		},
		'/auth/logout': {
			post: {
				tags: ['Auth'],
				summary: 'Logout',
				responses: {
					'200': { description: 'Logged out successfully' }
				}
			}
		},

		// Books
		'/books': {
			get: {
				tags: ['Books'],
				summary: 'List books',
				parameters: [
					{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
					{ name: 'limit', in: 'query', schema: { type: 'integer', default: 24 } },
					{ name: 'search', in: 'query', schema: { type: 'string' } },
					{ name: 'status', in: 'query', schema: { type: 'integer' } },
					{ name: 'genre', in: 'query', schema: { type: 'integer' } },
					{ name: 'format', in: 'query', schema: { type: 'integer' } },
					{ name: 'author', in: 'query', schema: { type: 'integer' } },
					{ name: 'series', in: 'query', schema: { type: 'integer' } },
					{ name: 'tag', in: 'query', schema: { type: 'integer' } },
					{ name: 'sort', in: 'query', schema: { type: 'string', enum: ['title', 'rating', 'dateAdded', 'completedDate'] } },
					{ name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } }
				],
				responses: {
					'200': { description: 'Paginated list of books' }
				}
			},
			post: {
				tags: ['Books'],
				summary: 'Create book',
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/BookInput' },
							example: {
								title: 'Test Book',
								statusId: 1,
								rating: 4,
								authors: [{ id: 1, role: 'Author', isPrimary: true }],
								series: [{ id: 1, bookNum: 1, isPrimary: true }]
							}
						}
					}
				},
				responses: {
					'201': { description: 'Book created' },
					'400': { description: 'Validation error' }
				}
			}
		},
		'/books/{id}': {
			get: {
				tags: ['Books'],
				summary: 'Get book by ID',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				responses: {
					'200': { description: 'Book details' },
					'404': { description: 'Book not found' }
				}
			},
			put: {
				tags: ['Books'],
				summary: 'Update book',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/BookInput' }
						}
					}
				},
				responses: {
					'200': { description: 'Book updated' },
					'404': { description: 'Book not found' }
				}
			},
			delete: {
				tags: ['Books'],
				summary: 'Delete book',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				responses: {
					'200': { description: 'Book deleted' },
					'404': { description: 'Book not found' }
				}
			}
		},
		'/books/options': {
			get: {
				tags: ['Books'],
				summary: 'Get book form options',
				description: 'Returns dropdown options for book forms (authors, series, genres, etc.)',
				responses: {
					'200': { description: 'Form options' }
				}
			}
		},
		'/books/lookup': {
			get: {
				tags: ['Books'],
				summary: 'Lookup book by ISBN or title',
				parameters: [
					{ name: 'isbn', in: 'query', schema: { type: 'string' } },
					{ name: 'query', in: 'query', schema: { type: 'string' } }
				],
				responses: {
					'200': { description: 'Book metadata from external sources' }
				}
			}
		},

		// Authors
		'/authors': {
			get: {
				tags: ['Authors'],
				summary: 'List authors',
				parameters: [
					{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
					{ name: 'limit', in: 'query', schema: { type: 'integer', default: 24 } },
					{ name: 'search', in: 'query', schema: { type: 'string' } }
				],
				responses: {
					'200': { description: 'Paginated list of authors' }
				}
			},
			post: {
				tags: ['Authors'],
				summary: 'Create author',
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/AuthorInput' },
							example: { name: 'New Author', bio: 'Author biography' }
						}
					}
				},
				responses: {
					'201': { description: 'Author created' }
				}
			}
		},
		'/authors/{id}': {
			get: {
				tags: ['Authors'],
				summary: 'Get author with books',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				responses: {
					'200': { description: 'Author details with books' },
					'404': { description: 'Author not found' }
				}
			},
			put: {
				tags: ['Authors'],
				summary: 'Update author',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/AuthorInput' }
						}
					}
				},
				responses: {
					'200': { description: 'Author updated' }
				}
			},
			delete: {
				tags: ['Authors'],
				summary: 'Delete author',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				responses: {
					'200': { description: 'Author deleted' }
				}
			}
		},

		// Series
		'/series': {
			get: {
				tags: ['Series'],
				summary: 'List series',
				parameters: [
					{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
					{ name: 'limit', in: 'query', schema: { type: 'integer', default: 24 } },
					{ name: 'search', in: 'query', schema: { type: 'string' } }
				],
				responses: {
					'200': { description: 'Paginated list of series' }
				}
			},
			post: {
				tags: ['Series'],
				summary: 'Create series',
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/SeriesInput' },
							example: { title: 'New Series' }
						}
					}
				},
				responses: {
					'201': { description: 'Series created' }
				}
			}
		},
		'/series/{id}': {
			get: {
				tags: ['Series'],
				summary: 'Get series with books',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				responses: {
					'200': { description: 'Series details with books' },
					'404': { description: 'Series not found' }
				}
			},
			put: {
				tags: ['Series'],
				summary: 'Update series',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/SeriesInput' }
						}
					}
				},
				responses: {
					'200': { description: 'Series updated' }
				}
			},
			delete: {
				tags: ['Series'],
				summary: 'Delete series',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				responses: {
					'200': { description: 'Series deleted' }
				}
			}
		},

		// Tags
		'/tags': {
			get: {
				tags: ['Tags'],
				summary: 'List tags',
				parameters: [
					{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
					{ name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }
				],
				responses: {
					'200': { description: 'Paginated list of tags' }
				}
			},
			post: {
				tags: ['Tags'],
				summary: 'Create tag',
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/TagInput' },
							example: { name: 'New Tag', color: '#3b82f6' }
						}
					}
				},
				responses: {
					'201': { description: 'Tag created' }
				}
			}
		},
		'/tags/quick': {
			post: {
				tags: ['Tags'],
				summary: 'Quick create tag',
				description: 'Create a tag with just a name (auto-assigns color)',
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: { name: { type: 'string' } },
								required: ['name']
							},
							example: { name: 'Quick Tag' }
						}
					}
				},
				responses: {
					'201': { description: 'Tag created' }
				}
			}
		},
		'/tags/toggle': {
			post: {
				tags: ['Tags'],
				summary: 'Toggle tag on book',
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									tagId: { type: 'integer' },
									bookId: { type: 'integer' }
								},
								required: ['tagId', 'bookId']
							},
							example: { tagId: 1, bookId: 1 }
						}
					}
				},
				responses: {
					'200': { description: 'Tag toggled' }
				}
			}
		},
		'/tags/{id}': {
			get: {
				tags: ['Tags'],
				summary: 'Get tag with books',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				responses: {
					'200': { description: 'Tag details with books' },
					'404': { description: 'Tag not found' }
				}
			},
			put: {
				tags: ['Tags'],
				summary: 'Update tag',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/TagInput' }
						}
					}
				},
				responses: {
					'200': { description: 'Tag updated' }
				}
			},
			delete: {
				tags: ['Tags'],
				summary: 'Delete tag',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				responses: {
					'200': { description: 'Tag deleted' }
				}
			}
		},

		// Genres
		'/genres': {
			get: {
				tags: ['Genres'],
				summary: 'List genres',
				parameters: [
					{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
					{ name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }
				],
				responses: {
					'200': { description: 'Paginated list of genres' }
				}
			},
			post: {
				tags: ['Genres'],
				summary: 'Create genre',
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/GenreInput' },
							example: { name: 'New Genre', color: '#22c55e', icon: 'book' }
						}
					}
				},
				responses: {
					'201': { description: 'Genre created' }
				}
			}
		},
		'/genres/{id}': {
			get: {
				tags: ['Genres'],
				summary: 'Get genre with books',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				responses: {
					'200': { description: 'Genre details with books' },
					'404': { description: 'Genre not found' }
				}
			},
			put: {
				tags: ['Genres'],
				summary: 'Update genre',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/GenreInput' }
						}
					}
				},
				responses: {
					'200': { description: 'Genre updated' }
				}
			},
			delete: {
				tags: ['Genres'],
				summary: 'Delete genre',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				responses: {
					'200': { description: 'Genre deleted' }
				}
			}
		},

		// Formats
		'/formats': {
			get: {
				tags: ['Formats'],
				summary: 'List formats',
				parameters: [
					{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
					{ name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }
				],
				responses: {
					'200': { description: 'Paginated list of formats' }
				}
			},
			post: {
				tags: ['Formats'],
				summary: 'Create format',
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/FormatInput' },
							example: { name: 'New Format' }
						}
					}
				},
				responses: {
					'201': { description: 'Format created' }
				}
			}
		},
		'/formats/{id}': {
			get: {
				tags: ['Formats'],
				summary: 'Get format with books',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				responses: {
					'200': { description: 'Format details with books' },
					'404': { description: 'Format not found' }
				}
			},
			put: {
				tags: ['Formats'],
				summary: 'Update format',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/FormatInput' }
						}
					}
				},
				responses: {
					'200': { description: 'Format updated' }
				}
			},
			delete: {
				tags: ['Formats'],
				summary: 'Delete format',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				responses: {
					'200': { description: 'Format deleted' }
				}
			}
		},

		// Narrators
		'/narrators': {
			get: {
				tags: ['Narrators'],
				summary: 'List narrators',
				parameters: [
					{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
					{ name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }
				],
				responses: {
					'200': { description: 'Paginated list of narrators' }
				}
			},
			post: {
				tags: ['Narrators'],
				summary: 'Create narrator',
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/NarratorInput' },
							example: { name: 'New Narrator', bio: 'Narrator biography' }
						}
					}
				},
				responses: {
					'201': { description: 'Narrator created' }
				}
			}
		},
		'/narrators/{id}': {
			get: {
				tags: ['Narrators'],
				summary: 'Get narrator with books',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				responses: {
					'200': { description: 'Narrator details with books' },
					'404': { description: 'Narrator not found' }
				}
			},
			put: {
				tags: ['Narrators'],
				summary: 'Update narrator',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/NarratorInput' }
						}
					}
				},
				responses: {
					'200': { description: 'Narrator updated' }
				}
			},
			delete: {
				tags: ['Narrators'],
				summary: 'Delete narrator',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				responses: {
					'200': { description: 'Narrator deleted' }
				}
			}
		},

		// Statuses
		'/statuses': {
			get: {
				tags: ['Statuses'],
				summary: 'List statuses',
				description: 'System-defined reading statuses',
				responses: {
					'200': { description: 'List of statuses' }
				}
			}
		},
		'/statuses/{id}': {
			get: {
				tags: ['Statuses'],
				summary: 'Get status with books',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				responses: {
					'200': { description: 'Status details with books' },
					'404': { description: 'Status not found' }
				}
			},
			put: {
				tags: ['Statuses'],
				summary: 'Update status name',
				description: 'Update status display name (for localization)',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: { name: { type: 'string' } }
							},
							example: { name: 'Gelesen' }
						}
					}
				},
				responses: {
					'200': { description: 'Status updated' }
				}
			}
		},

		// Ebooks
		'/ebooks/{id}/progress': {
			get: {
				tags: ['Ebooks'],
				summary: 'Get reading progress',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				responses: {
					'200': { description: 'Reading progress data' }
				}
			},
			post: {
				tags: ['Ebooks'],
				summary: 'Save reading progress',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									location: { type: 'string' },
									percentage: { type: 'number' }
								}
							},
							example: {
								location: 'epubcfi(/6/4!/4/2/1:0)',
								percentage: 25.5
							}
						}
					}
				},
				responses: {
					'200': { description: 'Progress saved' }
				}
			}
		},
		'/ebooks/{id}': {
			delete: {
				tags: ['Ebooks'],
				summary: 'Delete ebook from book',
				parameters: [
					{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
				],
				responses: {
					'200': { description: 'Ebook deleted' }
				}
			}
		},

		// Covers
		'/covers/download': {
			post: {
				tags: ['Covers'],
				summary: 'Download cover from URL',
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									url: { type: 'string', format: 'uri' },
									bookId: { type: 'integer' }
								},
								required: ['url', 'bookId']
							},
							example: {
								url: 'https://covers.openlibrary.org/b/isbn/9780544003415-L.jpg',
								bookId: 1
							}
						}
					}
				},
				responses: {
					'200': { description: 'Cover downloaded and saved' }
				}
			}
		},

		// Search
		'/search/autocomplete': {
			get: {
				tags: ['Search'],
				summary: 'Autocomplete search',
				parameters: [
					{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }
				],
				responses: {
					'200': { description: 'Search suggestions' }
				}
			}
		},

		// Import
		'/import/csv': {
			post: {
				tags: ['Import'],
				summary: 'Upload CSV for preview',
				requestBody: {
					required: true,
					content: {
						'multipart/form-data': {
							schema: {
								type: 'object',
								properties: {
									file: { type: 'string', format: 'binary' }
								}
							}
						}
					}
				},
				responses: {
					'200': { description: 'CSV preview data' }
				}
			},
			put: {
				tags: ['Import'],
				summary: 'Execute CSV import',
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									sessionId: { type: 'string' },
									selectedRows: { type: 'array', items: { type: 'integer' } },
									booksData: { type: 'array' }
								}
							}
						}
					}
				},
				responses: {
					'200': { description: 'Import results' }
				}
			}
		},
		'/import/audible': {
			post: {
				tags: ['Import'],
				summary: 'Upload Audible HTML for preview',
				requestBody: {
					required: true,
					content: {
						'multipart/form-data': {
							schema: {
								type: 'object',
								properties: {
									file: { type: 'string', format: 'binary' }
								}
							}
						}
					}
				},
				responses: {
					'200': { description: 'Audible preview data' }
				}
			},
			put: {
				tags: ['Import'],
				summary: 'Execute Audible import',
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									sessionId: { type: 'string' },
									selectedRows: { type: 'array', items: { type: 'integer' } },
									booksData: { type: 'array' },
									downloadCovers: { type: 'boolean' }
								}
							}
						}
					}
				},
				responses: {
					'200': { description: 'Import results' }
				}
			}
		},
		'/import/lookup': {
			get: {
				tags: ['Import'],
				summary: 'Lookup book metadata',
				parameters: [
					{ name: 'isbn', in: 'query', schema: { type: 'string' } },
					{ name: 'query', in: 'query', schema: { type: 'string' } }
				],
				responses: {
					'200': { description: 'Book metadata results' }
				}
			}
		},

		// Export
		'/export': {
			get: {
				tags: ['Export'],
				summary: 'Export library',
				description: 'Export your book library to CSV or JSON format',
				parameters: [
					{
						name: 'format',
						in: 'query',
						required: true,
						schema: { type: 'string', enum: ['csv', 'json'] },
						description: 'Export format'
					},
					{
						name: 'goodreads',
						in: 'query',
						schema: { type: 'boolean', default: false },
						description: 'Use Goodreads-compatible CSV format'
					},
					{
						name: 'authors',
						in: 'query',
						schema: { type: 'boolean', default: true },
						description: 'Include author data'
					},
					{
						name: 'series',
						in: 'query',
						schema: { type: 'boolean', default: true },
						description: 'Include series data'
					},
					{
						name: 'tags',
						in: 'query',
						schema: { type: 'boolean', default: true },
						description: 'Include tag data'
					},
					{
						name: 'genres',
						in: 'query',
						schema: { type: 'boolean', default: true },
						description: 'Include genre data'
					},
					{
						name: 'formats',
						in: 'query',
						schema: { type: 'boolean', default: true },
						description: 'Include format data'
					},
					{
						name: 'narrators',
						in: 'query',
						schema: { type: 'boolean', default: true },
						description: 'Include narrator data'
					},
					{
						name: 'statuses',
						in: 'query',
						schema: { type: 'boolean', default: true },
						description: 'Include status data'
					}
				],
				responses: {
					'200': {
						description: 'Export file',
						headers: {
							'Content-Disposition': {
								schema: { type: 'string' },
								description: 'Attachment filename'
							},
							'X-Book-Count': {
								schema: { type: 'integer' },
								description: 'Number of books exported'
							}
						},
						content: {
							'text/csv': {
								schema: { type: 'string' }
							},
							'application/json': {
								schema: { type: 'object' }
							}
						}
					}
				}
			}
		}
	},
	components: {
		schemas: {
			BookInput: {
				type: 'object',
				properties: {
					title: { type: 'string' },
					statusId: { type: 'integer' },
					genreId: { type: 'integer' },
					formatId: { type: 'integer' },
					narratorId: { type: 'integer' },
					rating: { type: 'integer', minimum: 0, maximum: 5 },
					pageCount: { type: 'integer' },
					isbn: { type: 'string' },
					isbn13: { type: 'string' },
					asin: { type: 'string' },
					publisher: { type: 'string' },
					publishedDate: { type: 'string', format: 'date' },
					description: { type: 'string' },
					comments: { type: 'string' },
					startReadingDate: { type: 'string', format: 'date' },
					completedDate: { type: 'string', format: 'date' },
					authors: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								id: { type: 'integer' },
								role: { type: 'string' },
								isPrimary: { type: 'boolean' }
							}
						}
					},
					series: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								id: { type: 'integer' },
								bookNum: { type: 'number' },
								isPrimary: { type: 'boolean' }
							}
						}
					},
					tags: { type: 'array', items: { type: 'integer' } }
				},
				required: ['title']
			},
			AuthorInput: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					bio: { type: 'string' }
				},
				required: ['name']
			},
			SeriesInput: {
				type: 'object',
				properties: {
					title: { type: 'string' },
					description: { type: 'string' }
				},
				required: ['title']
			},
			TagInput: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					color: { type: 'string' }
				},
				required: ['name']
			},
			GenreInput: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					color: { type: 'string' },
					icon: { type: 'string' }
				},
				required: ['name']
			},
			FormatInput: {
				type: 'object',
				properties: {
					name: { type: 'string' }
				},
				required: ['name']
			},
			NarratorInput: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					bio: { type: 'string' }
				},
				required: ['name']
			}
		}
	}
};
