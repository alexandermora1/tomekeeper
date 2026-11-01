using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tomekeeper.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBooks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "books",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    open_library_key = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    subtitle = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    authors = table.Column<List<string>>(type: "text[]", nullable: false),
                    first_published_year = table.Column<int>(type: "integer", nullable: true),
                    page_count = table.Column<int>(type: "integer", nullable: true),
                    cover_id = table.Column<int>(type: "integer", nullable: true),
                    added_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_books", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_books_open_library_key",
                table: "books",
                column: "open_library_key",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "books");
        }
    }
}
