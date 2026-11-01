using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tomekeeper.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBooksByHand : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_shelf_entries_books_book_id",
                table: "shelf_entries");

            migrationBuilder.AddColumn<Guid>(
                name: "added_by_id",
                table: "books",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_books_added_by_id",
                table: "books",
                column: "added_by_id");

            migrationBuilder.AddForeignKey(
                name: "fk_books_users_added_by_id",
                table: "books",
                column: "added_by_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_shelf_entries_books_book_id",
                table: "shelf_entries",
                column: "book_id",
                principalTable: "books",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_books_users_added_by_id",
                table: "books");

            migrationBuilder.DropForeignKey(
                name: "fk_shelf_entries_books_book_id",
                table: "shelf_entries");

            migrationBuilder.DropIndex(
                name: "ix_books_added_by_id",
                table: "books");

            migrationBuilder.DropColumn(
                name: "added_by_id",
                table: "books");

            migrationBuilder.AddForeignKey(
                name: "fk_shelf_entries_books_book_id",
                table: "shelf_entries",
                column: "book_id",
                principalTable: "books",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
