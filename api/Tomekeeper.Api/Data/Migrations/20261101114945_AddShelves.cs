using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tomekeeper.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddShelves : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "shelf_entries",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    book_id = table.Column<Guid>(type: "uuid", nullable: false),
                    shelf = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    added_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    shelved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_shelf_entries", x => new { x.user_id, x.book_id });
                    table.CheckConstraint("ck_shelf_entries_shelf", "shelf IN ('Reading', 'WantToRead', 'Finished', 'SetAside')");
                    table.ForeignKey(
                        name: "fk_shelf_entries_books_book_id",
                        column: x => x.book_id,
                        principalTable: "books",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_shelf_entries_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_shelf_entries_book_id",
                table: "shelf_entries",
                column: "book_id");

            migrationBuilder.CreateIndex(
                name: "ix_shelf_entries_user_id_shelved_at",
                table: "shelf_entries",
                columns: new[] { "user_id", "shelved_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "shelf_entries");
        }
    }
}
