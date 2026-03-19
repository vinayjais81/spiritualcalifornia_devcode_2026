export declare class CategorySelectionDto {
    categoryId: string;
    subcategoryIds?: string[];
    customSubcategoryNames?: string[];
}
export declare class SetCategoriesDto {
    categories: CategorySelectionDto[];
    modalities?: string[];
    issuesHelped?: string[];
}
